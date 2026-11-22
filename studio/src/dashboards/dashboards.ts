import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
import * as z from 'zod';
import {
	type DashboardContents,
	type DashboardDoc,
	type DashboardSharing,
	deleteDashboardDoc,
	loadDashboardDoc,
	readDashboardDoc,
	readSharing,
	writeDashboardDoc,
	writeSharing,
} from '@/dashboards/doc';
import { allowsLayout, isUnlisted } from '@/dashboards/unlisted';
import { createPersistedAtom } from '@/lib/persisted-store';
import { createId } from '@/lib/random-id';
import { focusedPanesStore, focusPane, zoomedPanesStore, zoomPane } from '@/dashboards/pane-state';
import { type PaneNode, paneIds } from '@/panes/layout';
import { restoreLayout, snapshotLayout } from '@/panes/layout-snapshot';
import { getRobotHost, simulatorHost } from '@/robot-target';
import { settingsStore } from '@/settings';

export type Dashboard = DashboardContents & {
	id: string;
	/** Whether it's shared with everyone connected to the robot, see `shareDashboards()` */
	shared: boolean;
	/** The pane the user last interacted with, use `getFocusedPane()` since it can be outdated */
	focusedPaneId?: string | undefined;
	/** The pane filling the dashboard while the others are hidden, use `getZoomedPane()` since it can be outdated */
	zoomedPaneId?: string | undefined;
};

/**
 * Dashboard IDs in sidebar order, first launch starts with one empty dashboard. Includes shared dashboards that aren't
 * shown: ones shared on another robot, and ones deleted by someone, which this device keeps sending to others for a while.
 */
export const idsStore = createPersistedAtom('dashboard-ids', z.array(z.string()), [createId()]);

/** Splitting, closing, or moving panes restores the zoomed pane's dashboard */
function restoreIfPanesChanged(id: string, before: PaneNode, after: PaneNode): void {
	if (paneIds(before).join(',') !== paneIds(after).join(',')) {
		zoomPane(id, undefined);
	}
}

type LoadedDashboard = DashboardDoc & {
	/** Read from its document, cleared when it changes */
	dashboard?: Dashboard | undefined;
	sharing?: DashboardSharing | undefined;
};

/** Every dashboard loaded by this window, closed ones are kept for their undo history */
export const docs = new Map<string, LoadedDashboard>();

/** `initial` is the contents of a dashboard that was never saved */
export function getDoc(id: string, initial?: DashboardContents): LoadedDashboard {
	let entry = docs.get(id);
	if (!entry) {
		// Undo steps are committed before the focus changes, so they save the pane that was focused before them
		const loaded: LoadedDashboard = loadDashboardDoc(id, () => focusedPanesStore.get()[id], initial);
		loaded.doc.subscribe(() => {
			loaded.dashboard = undefined;
			loaded.sharing = undefined;
			refresh();
		});
		docs.set(id, loaded);
		entry = loaded;
	}
	return entry;
}

function readDashboard(id: string): Dashboard {
	const entry = getDoc(id);
	const focusedPaneId = focusedPanesStore.get()[id];
	const zoomedPaneId = zoomedPanesStore.get()[id];
	if (
		!entry.dashboard ||
		entry.dashboard.focusedPaneId !== focusedPaneId ||
		entry.dashboard.zoomedPaneId !== zoomedPaneId
	) {
		// Keeps the same layout when only the focus or zoom changed
		const { name, layout } = entry.dashboard ?? readDashboardDoc(entry.doc);
		const shared = getSharing(id).scope !== undefined;
		entry.dashboard = { id, name, layout, shared, focusedPaneId, zoomedPaneId };
	}
	return entry.dashboard;
}

export function getSharing(id: string): DashboardSharing {
	const entry = getDoc(id);
	entry.sharing ??= readSharing(entry.doc);
	return entry.sharing;
}

/** The robot host that shared dashboards are scoped to, from the robot connection setting. The simulator counts as the robot. */
export function sharingScope(): string {
	return getRobotHost(settingsStore.get().robotTarget) ?? simulatorHost;
}

/** Dashboards on this device, and dashboards shared on the current robot unless someone deleted them */
function isShown({ scope, deletedAt }: DashboardSharing): boolean {
	return scope === undefined || (scope === sharingScope() && deletedAt === undefined);
}

/** Dashboards in sidebar order, shared ones last */
const store = createAtom<Dashboard[]>([]);

function refresh(): void {
	const shown = idsStore
		.get()
		.filter((id) => isShown(getSharing(id)))
		.map((id) => readDashboard(id));
	store.set([...shown.filter((dashboard) => !dashboard.shared), ...shown.filter((dashboard) => dashboard.shared)]);
}

refresh();
idsStore.subscribe(refresh);
settingsStore.subscribe(refresh);
focusedPanesStore.subscribe(refresh);
zoomedPanesStore.subscribe(refresh);

export function useDashboards(): Dashboard[] {
	return useSelector(store);
}

export function getDashboards(): Dashboard[] {
	return store.get();
}

export function getDashboard(id: string): Dashboard | undefined {
	return store.get().find((dashboard) => dashboard.id === id) ?? (isUnlisted(id) ? readDashboard(id) : undefined);
}

/** Called whenever a dashboard or the list changes, including dashboards that aren't shown */
export function subscribeDashboards(listener: () => void): () => void {
	const subscription = store.subscribe(listener);
	return () => subscription.unsubscribe();
}

/** Create a dashboard at the top or bottom of the list, empty or with `contents` */
export function createDashboard(position: 'top' | 'bottom' = 'top', contents?: DashboardContents): Dashboard {
	const id = createId();
	// Saves its document before its ID, so other windows find it
	getDoc(id, contents);
	const dashboard = readDashboard(id);
	idsStore.set((ids) => (position === 'top' ? [id, ...ids] : [...ids, id]));
	return dashboard;
}

/** Copy dashboards, each copy goes right below its original. Returns the copies' IDs. */
export function duplicateDashboards(ids: readonly string[]): string[] {
	const copies = new Map<string, string>();
	for (const id of ids) {
		const dashboard = getDashboard(id);
		if (dashboard) {
			const copyId = createId();
			// Saves its document before its ID, so other windows find it
			getDoc(copyId, { name: dashboard.name, layout: restoreLayout(snapshotLayout(dashboard.layout)) });
			copies.set(id, copyId);
		}
	}
	idsStore.set((openIds) =>
		openIds.flatMap((id) => {
			const copyId = copies.get(id);
			return copyId === undefined ? [id] : [id, copyId];
		}),
	);
	return [...copies.values()];
}

/** Change a dashboard, its contents changing is an undo step */
export function updateDashboard(id: string, update: (dashboard: Dashboard) => Dashboard): void {
	const dashboard = getDashboard(id);
	const updated = dashboard && update(dashboard);
	if (!dashboard || !updated || !allowsLayout(id, updated.layout)) {
		return;
	}
	const { doc } = getDoc(id);
	writeDashboardDoc(doc, updated);
	doc.commit();
	focusPane(id, updated.focusedPaneId);
	restoreIfPanesChanged(id, dashboard.layout, updated.layout);
}

/** Go back to the dashboard's state from before its last edit, including which pane was focused */
export function undoDashboard(id: string): void {
	travel(id, 'undo');
}

export function redoDashboard(id: string): void {
	travel(id, 'redo');
}

function travel(id: string, direction: 'undo' | 'redo'): void {
	const { doc } = getDoc(id);
	const before = readDashboardDoc(doc).layout;
	const restored = getDoc(id).travel(direction);
	if (restored !== false) {
		focusPane(id, restored.focusedPaneId);
		restoreIfPanesChanged(id, before, readDashboardDoc(doc).layout);
	}
}

/** A blank name goes back to suggesting one from the dashboard's contents */
export function renameDashboard(id: string, name: string): void {
	const trimmed = name.trim();
	updateDashboard(id, (dashboard) => ({ ...dashboard, name: trimmed === '' ? undefined : trimmed }));
}

/** Move a dashboard so it ends up at `index` among the shared dashboards, or the others */
export function moveDashboard(id: string, index: number): void {
	const dashboard = getDashboard(id);
	if (!dashboard) {
		return;
	}

	const section = store
		.get()
		.filter((other) => other.shared === dashboard.shared && other.id !== id)
		.map((other) => other.id);
	const order = [...section.slice(0, index), id, ...section.slice(index)];
	const ordered = new Set(order);
	idsStore.set((ids) => [...order, ...ids.filter((other) => !ordered.has(other))]);
}

const closedSchema = z.array(z.array(z.object({ id: z.string(), index: z.number() }))).catch([]);

/** Groups of dashboards that were closed together, oldest first, for reopening them like closed browser tabs */
export const closedStore = createPersistedAtom('closed-dashboard-ids', closedSchema, []);
const closedLimit = 25;

export function deleteDashboard(id: string): void {
	deleteDashboards([id]);
}

function setDeletedAt(id: string, deletedAt: number | undefined): void {
	const { doc } = getDoc(id);
	writeSharing(doc, { ...getSharing(id), deletedAt });
	doc.commit();
}

/**
 * Close dashboards, they can be brought back with `reopenClosedDashboards()`.
 * Shared dashboards are deleted for everyone, and stay in the list hidden so this device keeps telling others.
 */
export function deleteDashboards(ids: readonly string[]): void {
	const removed = new Set(ids);
	const openIds = idsStore.get();
	const closed = openIds.flatMap((id, index) => (removed.has(id) ? [{ id, index }] : []));
	if (closed.length === 0) {
		return;
	}

	const groups = [...closedStore.get(), closed];
	// Dashboards too old to reopen are deleted, shared ones once others had time to find out, see `removeExpired()`
	for (const { id } of groups.slice(0, -closedLimit).flat()) {
		if (getSharing(id).scope === undefined) {
			deleteDashboardDoc(id);
			focusPane(id, undefined);
		}
	}
	closedStore.set(groups.slice(-closedLimit));
	const shared = closed.filter(({ id }) => getSharing(id).scope !== undefined);
	for (const { id } of shared) {
		setDeletedAt(id, Date.now());
	}
	idsStore.set(openIds.filter((id) => !removed.has(id) || shared.some((other) => other.id === id)));
}

/** Put the most recently closed dashboards back where they were, returns the first of them */
export function reopenClosedDashboards(): Dashboard | undefined {
	const closed = closedStore.get().at(-1);
	if (!closed) {
		return undefined;
	}

	closedStore.set((groups) => groups.slice(0, -1));
	idsStore.set((ids) => {
		const reopened = [...ids];
		const open = new Set(ids);
		// In their original order, so each index lines up with the dashboards before it
		for (const { id, index } of closed) {
			if (!open.has(id)) {
				reopened.splice(index, 0, id);
			}
		}
		return reopened;
	});
	// Brings them back for everyone
	for (const { id } of closed) {
		if (getSharing(id).deletedAt !== undefined) {
			setDeletedAt(id, undefined);
		}
	}
	return closed[0] && getDashboard(closed[0].id);
}
