import * as z from 'zod';
import { getDashboard, subscribeDashboards } from '@/dashboards/dashboards';
import { getFocusedPane } from '@/dashboards/panes';
import { getSharedDocs, receiveSharedDashboard } from '@/dashboards/sharing';
import { studioTopicPrefix } from '@/data/samples';
import type { NtClient } from '@/nt/client';
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
const presenceInterval = 500;
const publishRetryDelay = 1000;

/** The topic `name`, published by this session. Values set before the server accepts it are sent once it does. */
function createPublisher(nt: NtClient, name: string, kind: 'raw' | 'string') {
	let published = false;
	let closed = false;
	let pending: string | Uint8Array | undefined;
	let retryTimer: ReturnType<typeof setTimeout> | undefined;
	const close = () => {
		closed = true;
		clearTimeout(retryTimer);
		if (published) {
			nt.unpublish(name);
		}
	};
	const publish = async () => {
		if (!nt.isConnected()) {
			return;
		}
		try {
			await nt.publish(name, kind);
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
			nt.setValue(name, pending);
		}
	};
	void publish();

	return {
		set(value: string | Uint8Array) {
			if (published) {
				nt.setValue(name, value);
			} else {
				pending = value;
			}
		},
		close,
	};
}

type Publisher = ReturnType<typeof createPublisher>;

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
 * `onConnectedChange` is called when the connection opens or drops. Returns a function that disconnects and closes `nt`.
 */
export function connectSharing(nt: NtClient, onConnectedChange: (connected: boolean) => void): () => void {
	const userId = userIdStore.get();

	const receive = (name: string, value: unknown) => {
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
	};
	nt.subscribe(
		studioTopicPrefix,
		{},
		{
			value: (name, _type, value) => receive(name, value),
			// Sessions are gone once they stop publishing, ex. when their window closes or disconnects
			unannounce: (name) => {
				if (sessionsStore.get().has(name)) {
					setSessions((sessions) => {
						sessions.delete(name);
					});
				}
			},
		},
	);

	const docPublishers = new Map<string, { publisher: Publisher; version: string | undefined }>();
	let docTimer: ReturnType<typeof setTimeout> | undefined;
	const sendDocs = () => {
		clearTimeout(docTimer);
		docTimer = undefined;
		if (!nt.isConnected()) {
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
					publisher: createPublisher(nt, `${studioTopicPrefix}${id}/doc/${sessionId}`, 'raw'),
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

	let presence: { name: string; publisher: Publisher; value: string | undefined } | undefined;
	let presenceTimer: ReturnType<typeof setTimeout> | undefined;
	let presenceSentAt = 0;
	const sendPresence = () => {
		clearTimeout(presenceTimer);
		presenceTimer = undefined;
		if (!nt.isConnected()) {
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
				name === undefined ? undefined : { name, publisher: createPublisher(nt, name, 'string'), value: undefined };
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
	// Notified right away, since the data source or another window might have connected already
	nt.onConnectedChange((connected) => {
		if (connected) {
			sendDocs();
			sendPresence();
		} else if (!wasConnected) {
			// Still connecting
			return;
		}
		wasConnected = connected;
		onConnectedChange(connected);
	});

	return () => {
		clearTimeout(docTimer);
		clearTimeout(presenceTimer);
		unsubscribeDashboards();
		activitySubscription.unsubscribe();
		settingsSubscription.unsubscribe();
		for (const { publisher } of docPublishers.values()) {
			publisher.close();
		}
		presence?.publisher.close();
		nt.close();
		sessionsStore.set(new Map());
	};
}
