// Syncs a team's Cloud dashboards. Cloud stores each dashboard as encrypted Loro updates in order, and a snapshot
// periodically replaces the updates before it, see `cloud/convex/cloudDashboards.ts`.
import type { ConvexReactClient } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { LoroDoc } from 'loro-crdt';
import { getDoc, getSharing, idsStore, subscribeDashboards } from '@/dashboards/dashboards';
import { readSharing, saveDashboardDoc } from '@/dashboards/doc';
import { api } from '../../../cloud/convex/_generated/api.js';
import { decryptUpdate, encryptUpdate } from './dashboard-crypto';
import { createKeyring } from './keyring';
import { type CloudSession, cloudScope, type TeamKey } from './session';
import {
	decodeVersion,
	discard,
	encodeVersion,
	getSyncState,
	hasUnpushed,
	includeUpdate,
	setSyncState,
} from './sync-state';

/** Matches the page size of `cloudDashboards.pull` */
const pullLimit = 100;
/** Replace a dashboard's updates with a snapshot once this many have built up */
const compactAfter = 50;
/** Changes are batched, so dragging a split or typing a name doesn't upload every step */
const pushDelay = 250;
const retryDelay = 5000;

type Update = NonNullable<FunctionReturnType<typeof api.cloudDashboards.pull>>[number];
type ListedDashboard = NonNullable<FunctionReturnType<typeof api.cloudDashboards.list>>[number];

/**
 * Keep the team's Cloud dashboards in sync with Cloud until the returned function is called. Only one window per
 * device should sync, the others follow its changes through local storage.
 */
export function startCloudSync(
	client: ConvexReactClient,
	session: CloudSession,
	teamKey: TeamKey,
	accountKey: CryptoKey,
): () => void {
	const { teamId } = session;
	const scope = cloudScope(teamId);
	let stopped = false;
	const queues = new Map<string, Promise<void>>();
	const pulls = new Map<string, { after: number; unsubscribe: () => void }>();
	/** Dashboards being downloaded for the first time, saved once caught up so they don't show half loaded */
	const incoming = new Map<string, { doc: LoroDoc; pulledSeq: number }>();
	/** Dashboards with updates this device couldn't decrypt, which a snapshot from here would drop */
	const incomplete = new Set<string>();
	const compacting = new Set<string>();
	let listed = new Map<string, ListedDashboard>();
	let pushTimer: ReturnType<typeof setTimeout> | undefined;

	/** Tasks for one dashboard run one at a time, so a pull and a push never see each other half done */
	function enqueue(id: string, task: () => Promise<void>): Promise<void> {
		const next = (queues.get(id) ?? Promise.resolve()).then(() => (stopped ? undefined : task()));
		const settled = next.catch(() => {
			// Uploads are retried, see `push()`, and downloads resume from the last imported update
		});
		queues.set(id, settled);
		return next;
	}

	const getDashboardKey = createKeyring(client, session, teamKey, accountKey);

	/** Whether a local dashboard is one of this team's, so a dashboard with the same ID is never merged into it */
	function isLocal(id: string): boolean {
		return idsStore.get().includes(id) && getSharing(id).scope === scope;
	}

	function watchPull(id: string): void {
		if (stopped || (idsStore.get().includes(id) && !isLocal(id))) {
			return;
		}
		if (!isLocal(id) && !incoming.has(id)) {
			incoming.set(id, { doc: new LoroDoc(), pulledSeq: 0 });
		}
		const after = incoming.get(id)?.pulledSeq ?? getSyncState(id)?.pulledSeq ?? 0;
		const existing = pulls.get(id);
		if (existing?.after === after) {
			return;
		}
		existing?.unsubscribe();
		const watch = client.watchQuery(api.cloudDashboards.pull, { dashboardId: id, after });
		const handle = () => {
			let updates: Update[] | null | undefined;
			try {
				updates = watch.localQueryResult();
			} catch {
				return;
			}
			if (updates) {
				const received = updates;
				void enqueue(id, () => receive(id, after, received));
			}
		};
		pulls.set(id, { after, unsubscribe: watch.onUpdate(handle) });
		handle();
	}

	async function decryptAll(id: string, updates: Update[]): Promise<Uint8Array<ArrayBuffer>[]> {
		const decrypted = await Promise.all(
			updates.map(async (update) => {
				const key = await getDashboardKey(id, update.keyVersion);
				try {
					return key
						? await decryptUpdate(key, { teamId, dashboardId: id, keyVersion: update.keyVersion }, update)
						: undefined;
				} catch {
					return undefined;
				}
			}),
		);
		const readable = decrypted.filter((bytes) => bytes !== undefined);
		if (readable.length !== updates.length) {
			incomplete.add(id);
		}
		return readable;
	}

	async function receive(id: string, after: number, updates: Update[]): Promise<void> {
		const pending = incoming.get(id);
		const last = updates.at(-1);
		if ((pending?.pulledSeq ?? getSyncState(id)?.pulledSeq ?? 0) !== after || !last) {
			return;
		}
		const bytes = await decryptAll(id, updates);
		const doc = pending?.doc ?? getDoc(id).doc;
		try {
			doc.importBatch(bytes);
		} catch {
			incomplete.add(id);
		}
		if (pending) {
			pending.pulledSeq = last.seq;
			if (updates.length < pullLimit) {
				finishIncoming(id, pending);
			}
		} else {
			saveDashboardDoc(id, doc);
			const state = getSyncState(id);
			setSyncState(id, {
				pulledSeq: last.seq,
				membershipId: state?.membershipId ?? session.membershipId,
				pushed:
					state?.pushed === undefined
						? undefined
						: bytes.reduce((pushed, update) => includeUpdate(pushed, update), state.pushed),
			});
		}
		watchPull(id);
		maybeCompact(id);
	}

	function finishIncoming(id: string, { doc, pulledSeq }: { doc: LoroDoc; pulledSeq: number }): void {
		incoming.delete(id);
		// A dashboard that isn't this team's can't be shown with the team's dashboards
		if (readSharing(doc).scope !== scope || idsStore.get().includes(id)) {
			pulls.get(id)?.unsubscribe();
			return;
		}
		// Saved first so loading it doesn't start it with an empty layout
		saveDashboardDoc(id, doc);
		setSyncState(id, { pulledSeq, membershipId: session.membershipId, pushed: encodeVersion(doc.oplogVersion()) });
		getDoc(id);
		idsStore.set((ids) => (ids.includes(id) ? ids : [...ids, id]));
	}

	/** Upload local changes, or a snapshot replacing the updates through `replacesThrough` */
	async function push(id: string, replacesThrough?: number): Promise<void> {
		if (!isLocal(id) || incoming.has(id)) {
			return;
		}
		const state = getSyncState(id);
		const { doc } = getDoc(id);
		const version = doc.oplogVersion();
		const from = replacesThrough === undefined && state?.pushed !== undefined ? decodeVersion(state.pushed) : undefined;
		if (from && (version.compare(from) ?? 1) <= 0) {
			return;
		}
		const snapshot = from === undefined;
		const bytes = from ? doc.export({ mode: 'update', from }) : doc.export({ mode: 'snapshot' });
		const keyVersion = teamKey.keyVersion;
		const key = await getDashboardKey(id, keyVersion);
		if (!key) {
			throw new Error('Couldn’t derive the dashboard key.');
		}
		const encrypted = await encryptUpdate(key, { teamId, dashboardId: id, keyVersion }, bytes);
		const seq = await client.mutation(api.cloudDashboards.push, {
			membershipId: session.membershipId,
			dashboardId: id,
			keyVersion,
			...encrypted,
			// A snapshot includes every update this device imported, so it can replace them
			replacesThrough: snapshot && !incomplete.has(id) ? (replacesThrough ?? state?.pulledSeq ?? 0) : undefined,
		});
		const pulledSeq = getSyncState(id)?.pulledSeq ?? 0;
		setSyncState(id, {
			membershipId: session.membershipId,
			pushed: encodeVersion(version),
			// Skip downloading this upload again unless others uploaded in between
			pulledSeq: seq === pulledSeq + 1 ? seq : pulledSeq,
		});
		watchPull(id);
		maybeCompact(id);
	}

	function pushAll(): void {
		pushTimer = undefined;
		for (const id of idsStore.get()) {
			if (isLocal(id)) {
				void enqueue(id, () => push(id)).catch(() => schedulePush(retryDelay));
			}
		}
	}

	function schedulePush(delay = pushDelay): void {
		if (!stopped) {
			pushTimer ??= setTimeout(pushAll, delay);
		}
	}

	/** Replace a dashboard's updates with a snapshot under the current key, once this device has all of them */
	function maybeCompact(id: string): void {
		const info = listed.get(id);
		const caughtUp = info !== undefined && isLocal(id) && getSyncState(id)?.pulledSeq === info.seq;
		const due =
			caughtUp &&
			(info.compactedKeyVersion !== teamKey.keyVersion || info.seq - (info.compactedSeq ?? 0) >= compactAfter);
		if (!due || incomplete.has(id) || compacting.has(id)) {
			return;
		}
		compacting.add(id);
		void enqueue(id, () => push(id, info.seq))
			.catch(() => undefined)
			.finally(() => {
				compacting.delete(id);
			});
	}

	function handleList(dashboards: ListedDashboard[]): void {
		listed = new Map(dashboards.map((dashboard) => [dashboard.dashboardId, dashboard]));
		for (const { dashboardId: id } of dashboards) {
			watchPull(id);
			maybeCompact(id);
		}
	}

	// Edits made under a membership that ended aren't uploaded, see the shared-dashboards spec
	for (const id of idsStore.get()) {
		const state = getSyncState(id);
		if (isLocal(id) && state && state.membershipId !== session.membershipId) {
			if (hasUnpushed(getDoc(id).doc.oplogVersion(), state.pushed)) {
				discard(id);
			} else {
				setSyncState(id, { ...state, membershipId: session.membershipId });
			}
		}
	}

	const listWatch = client.watchQuery(api.cloudDashboards.list, {});
	const handleListUpdate = () => {
		try {
			const dashboards = listWatch.localQueryResult();
			if (dashboards) {
				handleList(dashboards);
			}
		} catch {
			// Retried on the next update
		}
	};
	const unsubscribeList = listWatch.onUpdate(handleListUpdate);
	handleListUpdate();
	const unsubscribeDashboards = subscribeDashboards(() => schedulePush());
	let wasConnected = client.connectionState().isWebSocketConnected;
	const unsubscribeConnection = client.subscribeToConnectionState(({ isWebSocketConnected }) => {
		if (isWebSocketConnected && !wasConnected) {
			schedulePush(0);
			handleList([...listed.values()]);
		}
		wasConnected = isWebSocketConnected;
	});
	schedulePush(0);

	return () => {
		stopped = true;
		clearTimeout(pushTimer);
		unsubscribeList();
		unsubscribeDashboards();
		unsubscribeConnection();
		for (const { unsubscribe } of pulls.values()) {
			unsubscribe();
		}
	};
}
