import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
import { customAlphabet } from 'nanoid';
import * as z from 'zod';
import {
	type DashboardContents,
	type DashboardDoc,
	deleteDashboardDoc,
	loadDashboardDoc,
	readDashboardDoc,
	writeDashboardDoc,
} from '@/dashboards/doc';
import { createPersistedAtom } from '@/lib/persisted-store';
import { copyLayout } from '@/panes/layout';

export type Dashboard = DashboardContents & {
	id: string;
	/** The pane the user last interacted with, use `getFocusedPane()` since it can be outdated */
	focusedPaneId?: string | undefined;
};

/** Short enough for shareable URLs, random enough (~95 bits) to be unguessable. No `-` or `_`, which break links in chat apps. */
const createDashboardId = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 16);

/** Dashboard IDs in sidebar order, first launch starts with one empty dashboard */
const idsStore = createPersistedAtom('dashboard-ids', z.array(z.string()), [createDashboardId()]);

/** Each dashboard's focused pane, kept outside its document since it isn't part of the dashboard */
const focusedPanesStore = createPersistedAtom(
	'focused-panes',
	z.record(z.string(), z.string().optional()).catch({}),
	{},
);

/** Focusing a pane isn't a change to the dashboard, so it isn't undone */
export function focusPane(id: string, paneId: string | undefined): void {
	// Called on every click in a pane, so skip updates that wouldn't change anything
	if (focusedPanesStore.get()[id] !== paneId) {
		focusedPanesStore.set((focusedPanes) => ({ ...focusedPanes, [id]: paneId }));
	}
}

type LoadedDashboard = DashboardDoc & {
	/** Read from its document, cleared when it changes */
	dashboard?: Dashboard | undefined;
};

/** Every dashboard loaded by this window, closed ones are kept for their undo history */
const docs = new Map<string, LoadedDashboard>();

/** `initial` is the contents of a dashboard that was never saved */
function getDoc(id: string, initial?: DashboardContents): LoadedDashboard {
	let entry = docs.get(id);
	if (!entry) {
		// Undo steps are committed before the focus changes, so they save the pane that was focused before them
		const loaded: LoadedDashboard = loadDashboardDoc(id, () => focusedPanesStore.get()[id], initial);
		loaded.doc.subscribe(() => {
			loaded.dashboard = undefined;
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
	if (!entry.dashboard || entry.dashboard.focusedPaneId !== focusedPaneId) {
		// Keeps the same layout when only the focus changed
		const { name, layout } = entry.dashboard ?? readDashboardDoc(entry.doc);
		entry.dashboard = { id, name, layout, focusedPaneId };
	}
	return entry.dashboard;
}

/** Dashboards in sidebar order */
const store = createAtom<Dashboard[]>([]);

function refresh(): void {
	store.set(idsStore.get().map((id) => readDashboard(id)));
}

refresh();
idsStore.subscribe(refresh);
focusedPanesStore.subscribe(refresh);

export function useDashboards(): Dashboard[] {
	return useSelector(store);
}

export function getDashboards(): Dashboard[] {
	return store.get();
}

export function getDashboard(id: string): Dashboard | undefined {
	return store.get().find((dashboard) => dashboard.id === id);
}

/** Create an empty dashboard at the top or bottom of the list */
export function createDashboard(position: 'top' | 'bottom' = 'top'): Dashboard {
	const id = createDashboardId();
	// Saves its document before its ID, so other windows find it
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
			const copyId = createDashboardId();
			// Saves its document before its ID, so other windows find it
			getDoc(copyId, { name: dashboard.name, layout: copyLayout(dashboard.layout) });
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
	if (!dashboard) {
		return;
	}

	const updated = update(dashboard);
	const { doc } = getDoc(id);
	writeDashboardDoc(doc, updated);
	doc.commit();
	focusPane(id, updated.focusedPaneId);
}

/** Go back to the dashboard's state from before its last edit, including which pane was focused */
export function undoDashboard(id: string): void {
	travel(id, 'undo');
}

export function redoDashboard(id: string): void {
	travel(id, 'redo');
}

function travel(id: string, direction: 'undo' | 'redo'): void {
	const restored = getDoc(id).travel(direction);
	if (restored !== false) {
		focusPane(id, restored.focusedPaneId);
	}
}

/** A blank name goes back to suggesting one from the dashboard's contents */
export function renameDashboard(id: string, name: string): void {
	const trimmed = name.trim();
	updateDashboard(id, (dashboard) => ({ ...dashboard, name: trimmed === '' ? undefined : trimmed }));
}

/** Move a dashboard so it ends up at `index` */
export function moveDashboard(id: string, index: number): void {
	idsStore.set((ids) => {
		if (!ids.includes(id)) {
			return ids;
		}

		const rest = ids.filter((other) => other !== id);
		return [...rest.slice(0, index), id, ...rest.slice(index)];
	});
}

const closedDashboardSchema = z.object({ id: z.string(), index: z.number() });

/** Groups of dashboards that were closed together, oldest first, for reopening them like closed browser tabs */
const closedStore = createPersistedAtom('closed-dashboard-ids', z.array(z.array(closedDashboardSchema)).catch([]), []);
const closedLimit = 25;

export function deleteDashboard(id: string): void {
	deleteDashboards([id]);
}

/** Close dashboards, they can be brought back with `reopenClosedDashboards()` */
export function deleteDashboards(ids: readonly string[]): void {
	const removed = new Set(ids);
	const openIds = idsStore.get();
	const closed = openIds.flatMap((id, index) => (removed.has(id) ? [{ id, index }] : []));
	if (closed.length === 0) {
		return;
	}

	const groups = [...closedStore.get(), closed];
	// Dashboards too old to reopen are deleted
	for (const { id } of groups.slice(0, -closedLimit).flat()) {
		deleteDashboardDoc(id);
		focusPane(id, undefined);
	}
	closedStore.set(groups.slice(-closedLimit));
	idsStore.set(openIds.filter((id) => !removed.has(id)));
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
		// In their original order, so each index lines up with the dashboards before it
		for (const { id, index } of closed) {
			reopened.splice(index, 0, id);
		}
		return reopened;
	});
	return closed[0] && getDashboard(closed[0].id);
}
