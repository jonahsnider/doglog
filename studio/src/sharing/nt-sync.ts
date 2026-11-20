import type { NetworkTables, NetworkTablesTopic } from '@ntcore-ts/client';
import * as z from 'zod';
import { getDashboard, subscribeDashboards } from '@/dashboards/dashboards';
import { getFocusedPane } from '@/dashboards/panes';
import { getSharedDocs, receiveSharedDashboard } from '@/dashboards/sharing';
import { studioTopicPrefix } from '@/data/samples';
import { settingsStore } from '@/settings';
import { getDisplayName, sessionId, userIdStore } from '@/sharing/identity';
import { localActivityStore, type Session, sessionsStore } from '@/sharing/presence';

// Topics are `/DogLogStudio/{dashboard ID}/doc/{session ID}`, a snapshot of the dashboard's Loro document,
// and `/DogLogStudio/{dashboard ID}/presence/{user ID}/{session ID}`, a JSON `presenceSchema`.
const docTopicPattern = /^\/DogLogStudio\/([^/]+)\/doc\/([^/]+)$/u;
const presenceTopicPattern = /^\/DogLogStudio\/([^/]+)\/presence\/([^/]+)\/([^/]+)$/u;

const presenceSchema = z.object({
	name: z.string(),
	paneId: z.string().optional(),
	lastActiveAt: z.number(),
});

/** Changes are batched, so dragging a split or typing a name doesn't send a snapshot for every step */
const docDelay = 250;
/** Presence is sent at most twice a second */
const presenceInterval = 500;
const publishRetryDelay = 1000;

/** Called by our @ntcore-ts/client patch when a topic under a prefix topic is gone */
type UnannounceListener = (params: { name: string }) => void;

/** A topic this session publishes. Values set before the server accepts it are sent once it does. */
function createPublisher<T extends string | Uint8Array>(nt: NetworkTables, topic: NetworkTablesTopic<T>) {
	let published = false;
	let closed = false;
	let pending: T | undefined;
	let retryTimer: ReturnType<typeof setTimeout> | undefined;
	const close = () => {
		closed = true;
		clearTimeout(retryTimer);
		if (published && topic.pubuid !== undefined) {
			topic.unpublish();
		}
	};
	const publish = async () => {
		if (!nt.isRobotConnected()) {
			return;
		}
		try {
			await topic.publish();
		} catch {
			// A missed announcement must not strand the latest value. Disconnect disposes this publisher.
			if (!closed) {
				retryTimer = setTimeout(() => void publish(), publishRetryDelay);
			}
			return;
		}
		published = true;
		if (closed) {
			close();
		} else if (pending !== undefined) {
			topic.setValue(pending);
		}
	};
	void publish();

	return {
		set(value: T) {
			if (published) {
				topic.setValue(value);
			} else {
				pending = value;
			}
		},
		close,
	};
}

type Publisher<T extends string | Uint8Array> = ReturnType<typeof createPublisher<T>>;

function parsePresence(value: unknown): z.infer<typeof presenceSchema> | undefined {
	try {
		return typeof value === 'string' ? presenceSchema.parse(JSON.parse(value)) : undefined;
	} catch {
		return undefined;
	}
}

function setSessions(update: (sessions: Map<string, Session>) => void): void {
	sessionsStore.set((sessions) => {
		const updated = new Map(sessions);
		update(updated);
		return updated;
	});
}

/**
 * Sync shared dashboards and presence through `nt`.
 * `onConnectedChange` is called when the connection opens or drops. Returns a function that disconnects.
 */
export function connectSharing(nt: NetworkTables, onConnectedChange: (connected: boolean) => void): () => void {
	// Shared with the data source when it's connected to the same server
	nt.retain();
	const userId = userIdStore.get();

	// Every dashboard others share, and where they are in them
	const prefixTopic = nt.getPrefixTopic(studioTopicPrefix);
	const subscription = prefixTopic.subscribe((value, { name }) => {
		const doc = docTopicPattern.exec(name);
		if (doc?.[1] !== undefined && doc[2] !== sessionId && value instanceof Uint8Array) {
			receiveSharedDashboard(doc[1], value);
			return;
		}

		const [, dashboardId, sessionUserId, otherSessionId] = presenceTopicPattern.exec(name) ?? [];
		// This user's other sessions aren't shown
		if (
			dashboardId === undefined ||
			sessionUserId === undefined ||
			otherSessionId === undefined ||
			sessionUserId === userId
		) {
			return;
		}
		const parsed = parsePresence(value);
		setSessions((sessions) => {
			if (parsed) {
				sessions.set(name, { ...parsed, userId: sessionUserId, sessionId: otherSessionId, dashboardId });
			} else {
				sessions.delete(name);
			}
		});
	});
	// Sessions are gone once they stop publishing, ex. when their window closes or disconnects
	(prefixTopic as typeof prefixTopic & { onUnannounce?: UnannounceListener }).onUnannounce = ({ name }) => {
		if (sessionsStore.get().has(name)) {
			setSessions((sessions) => {
				sessions.delete(name);
			});
		}
	};

	// Shared dashboards, by ID, with the version last sent
	const docPublishers = new Map<string, { publisher: Publisher<Uint8Array>; version: string | undefined }>();
	let docTimer: ReturnType<typeof setTimeout> | undefined;
	const sendDocs = () => {
		clearTimeout(docTimer);
		docTimer = undefined;
		if (!nt.isRobotConnected()) {
			return;
		}
		const docs = getSharedDocs();
		const ids = new Set(docs.map(({ id }) => id));
		for (const [id, { publisher }] of docPublishers) {
			if (!ids.has(id)) {
				publisher.close();
				docPublishers.delete(id);
			}
		}

		for (const { id, doc } of docs) {
			let sent = docPublishers.get(id);
			if (!sent) {
				sent = {
					publisher: createPublisher(nt, nt.getRawTopic(`${studioTopicPrefix}${id}/doc/${sessionId}`)),
					version: undefined,
				};
				docPublishers.set(id, sent);
			}

			const version = JSON.stringify(doc.oplogFrontiers());
			if (sent.version !== version) {
				sent.version = version;
				sent.publisher.set(doc.export({ mode: 'snapshot' }));
			}
		}
	};
	const scheduleDocs = () => {
		docTimer ??= setTimeout(sendDocs, docDelay);
	};

	// This session's presence in the shared dashboard it shows
	let presence: { name: string; publisher: Publisher<string>; value: string | undefined } | undefined;
	let presenceTimer: ReturnType<typeof setTimeout> | undefined;
	let presenceSentAt = 0;
	const sendPresence = () => {
		clearTimeout(presenceTimer);
		presenceTimer = undefined;
		if (!nt.isRobotConnected()) {
			return;
		}
		presenceSentAt = Date.now();
		const { dashboardId, lastActiveAt } = localActivityStore.get();
		const dashboard = dashboardId === undefined ? undefined : getDashboard(dashboardId);
		const name =
			dashboard?.shared === true ? `${studioTopicPrefix}${dashboard.id}/presence/${userId}/${sessionId}` : undefined;
		if (presence?.name !== name) {
			presence?.publisher.close();
			presence =
				name === undefined
					? undefined
					: { name, publisher: createPublisher(nt, nt.getStringTopic(name)), value: undefined };
		}
		if (!presence || !dashboard) {
			return;
		}

		const value = JSON.stringify({
			name: getDisplayName(),
			// The first pane until another is focused, like keyboard shortcuts
			paneId: getFocusedPane(dashboard).id,
			lastActiveAt,
		} satisfies z.input<typeof presenceSchema>);
		if (presence.value !== value) {
			presence.value = value;
			presence.publisher.set(value);
		}
	};
	const schedulePresence = () => {
		presenceTimer ??= setTimeout(sendPresence, Math.max(0, presenceSentAt + presenceInterval - Date.now()));
	};

	const unsubscribeDashboards = subscribeDashboards(() => {
		scheduleDocs();
		// Includes focusing another pane
		schedulePresence();
	});
	const activitySubscription = localActivityStore.subscribe(schedulePresence);
	const settingsSubscription = settingsStore.subscribe(schedulePresence);
	let wasConnected = false;
	// Notified right away, since the data source might have connected already
	const removeConnectionListener = nt.addRobotConnectionListener((connected) => {
		if (connected) {
			sendDocs();
			sendPresence();
		} else if (!wasConnected) {
			// Still connecting
			return;
		}
		wasConnected = connected;
		onConnectedChange(connected);
	}, true);

	return () => {
		clearTimeout(docTimer);
		clearTimeout(presenceTimer);
		unsubscribeDashboards();
		activitySubscription.unsubscribe();
		settingsSubscription.unsubscribe();
		removeConnectionListener();
		for (const { publisher } of docPublishers.values()) {
			publisher.close();
		}
		presence?.publisher.close();
		prefixTopic.unsubscribe(subscription, true);
		sessionsStore.set(new Map());
		nt.release();
	};
}
