import { useSelector } from '@tanstack/react-store';
import * as z from 'zod';
import { createPersistedAtom } from '@/lib/persisted-store';
import {
	canSplitPane,
	closePane,
	createPane,
	findPane,
	findSibling,
	findWidgetPane,
	firstPane,
	type Pane,
	type PaneNode,
	paneNodeSchema,
	setPaneWidget,
	type SplitDirection,
	splitPane,
	type Widget,
} from '@/pane-layout';
import { widgetConfigSchema } from '@/widgets/widget-type';

const dashboardSchema = z.object({
	id: z.string(),
	/** Set when the user renames the dashboard, otherwise a name is suggested from its contents with `dashboardName()` */
	name: z.string().optional(),
	layout: paneNodeSchema.catch(() => createPane()),
	/** The pane the user last interacted with, use `getFocusedPane()` since it can be outdated */
	focusedPaneId: z.string().optional().catch(undefined),
});

export type Dashboard = z.infer<typeof dashboardSchema>;

// Invalid dashboards are dropped instead of resetting every dashboard
const dashboardsSchema = z
	.array(dashboardSchema.nullable().catch(null))
	.transform((dashboards) => dashboards.filter((dashboard) => dashboard !== null));

function newDashboard(): Dashboard {
	return { id: crypto.randomUUID(), layout: createPane() };
}

/** Dashboards in sidebar order, first launch starts with one empty dashboard */
const store = createPersistedAtom('dashboards', dashboardsSchema, [newDashboard()]);

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
	const dashboard = newDashboard();
	store.set((dashboards) => (position === 'top' ? [dashboard, ...dashboards] : [...dashboards, dashboard]));
	return dashboard;
}

type History = { undo: Dashboard[]; redo: Dashboard[] };

/** Each dashboard's undo history, kept for the session so a reopened dashboard can still undo */
const histories = new Map<string, History>();
const historyLimit = 100;

function setDashboard(dashboard: Dashboard): void {
	store.set((dashboards) => dashboards.map((other) => (other.id === dashboard.id ? dashboard : other)));
}

/** Focusing a pane isn't an edit, and some operations recreate a layout without changing it */
function sameContents(a: Dashboard, b: Dashboard): boolean {
	return a.name === b.name && JSON.stringify(a.layout) === JSON.stringify(b.layout);
}

/** Change a dashboard, saving its previous state as an undo step if its contents changed */
function updateDashboard(id: string, update: (dashboard: Dashboard) => Dashboard): void {
	const dashboard = getDashboard(id);
	if (!dashboard) {
		return;
	}

	const updated = update(dashboard);
	if (!sameContents(dashboard, updated)) {
		const history = histories.get(id) ?? { undo: [], redo: [] };
		history.undo = [...history.undo, dashboard].slice(-historyLimit);
		history.redo = [];
		histories.set(id, history);
	}
	setDashboard(updated);
}

/** Go back to the dashboard's state from before its last edit, including which pane was focused */
export function undoDashboard(id: string): void {
	travel(id, 'undo', 'redo');
}

export function redoDashboard(id: string): void {
	travel(id, 'redo', 'undo');
}

function travel(id: string, from: keyof History, to: keyof History): void {
	const dashboard = getDashboard(id);
	const history = histories.get(id);
	const target = dashboard && history?.[from].pop();
	if (dashboard && history && target) {
		history[to].push(dashboard);
		setDashboard(target);
	}
}

/** A blank name goes back to suggesting one from the dashboard's contents */
export function renameDashboard(id: string, name: string): void {
	const trimmed = name.trim();
	updateDashboard(id, (dashboard) => ({ ...dashboard, name: trimmed === '' ? undefined : trimmed }));
}

/** Move a dashboard so it ends up at `index` */
export function moveDashboard(id: string, index: number): void {
	store.set((dashboards) => {
		const dashboard = dashboards.find((other) => other.id === id);
		if (!dashboard) {
			return dashboards;
		}

		const rest = dashboards.filter((other) => other !== dashboard);
		return [...rest.slice(0, index), dashboard, ...rest.slice(index)];
	});
}

const closedDashboardSchema = z.object({ dashboard: dashboardSchema, index: z.number() });

/** Groups of dashboards that were closed together, oldest first, for reopening them like closed browser tabs */
const closedStore = createPersistedAtom('closed-dashboards', z.array(z.array(closedDashboardSchema)).catch([]), []);
const closedLimit = 25;

export function deleteDashboard(id: string): void {
	deleteDashboards([id]);
}

/** Close dashboards, they can be brought back with `reopenClosedDashboards()` */
export function deleteDashboards(ids: readonly string[]): void {
	const removed = new Set(ids);
	const dashboards = store.get();
	const closed = dashboards.flatMap((dashboard, index) => (removed.has(dashboard.id) ? [{ dashboard, index }] : []));
	if (closed.length === 0) {
		return;
	}

	closedStore.set((groups) => [...groups, closed].slice(-closedLimit));
	store.set(dashboards.filter((dashboard) => !removed.has(dashboard.id)));
}

/** Put the most recently closed dashboards back where they were, returns the first of them */
export function reopenClosedDashboards(): Dashboard | undefined {
	const closed = closedStore.get().at(-1);
	if (!closed) {
		return undefined;
	}

	closedStore.set((groups) => groups.slice(0, -1));
	store.set((dashboards) => {
		const reopened = [...dashboards];
		// In their original order, so each index lines up with the dashboards before it
		for (const { dashboard, index } of closed) {
			reopened.splice(index, 0, dashboard);
		}
		return reopened;
	});
	return closed[0]?.dashboard;
}

/**
 * Change a dashboard's pane layout with one of the `@/pane-layout` operations.
 * @example updateLayout(dashboardId, (layout) => setPaneWidget(layout, paneId, widget))
 */
export function updateLayout(id: string, update: (layout: PaneNode) => PaneNode): void {
	updateDashboard(id, (dashboard) => ({ ...dashboard, layout: update(dashboard.layout) }));
}

/** The pane that keyboard shortcuts act on, the first pane if the focused pane is gone */
export function getFocusedPane(dashboard: Dashboard): Pane {
	const focused =
		dashboard.focusedPaneId === undefined ? undefined : findPane(dashboard.layout, dashboard.focusedPaneId);
	return focused ?? firstPane(dashboard.layout);
}

export function focusPane(id: string, paneId: string): void {
	// Called on every click in a pane, so skip updates that wouldn't change anything
	if (store.get().some((dashboard) => dashboard.id === id && dashboard.focusedPaneId !== paneId)) {
		updateDashboard(id, (dashboard) => ({ ...dashboard, focusedPaneId: paneId }));
	}
}

/** Split a pane and focus the new pane */
export function splitDashboardPane(id: string, paneId: string, direction: SplitDirection): void {
	const newPane = createPane();
	updateDashboard(id, (dashboard) => ({
		...dashboard,
		layout: splitPane(dashboard.layout, paneId, direction, newPane),
		focusedPaneId: newPane.id,
	}));
}

/** Splits along the longer side of the pane's element, so adding several widgets tiles the dashboard instead of making slivers */
function splitDirectionFor(paneId: string): SplitDirection {
	const rect = document.querySelector(`[data-pane-id="${CSS.escape(paneId)}"]`)?.getBoundingClientRect();
	return rect && rect.height > rect.width ? 'column' : 'row';
}

/**
 * Add a widget's entries to a widget of the same type (preferring the focused pane), show the widget in the focused pane
 * if it's empty, or otherwise split the focused pane and show it in the new pane. The pane it ends up in is focused.
 * Does nothing if the focused pane can't be split in either direction.
 */
export function addDashboardWidget(id: string, widget: Widget): void {
	updateDashboard(id, (dashboard) => {
		const focused = getFocusedPane(dashboard);
		const matching = focused.widget?.type === widget.type ? focused : findWidgetPane(dashboard.layout, widget.type);
		if (matching?.widget !== undefined) {
			const { entryNames } = widgetConfigSchema.parse(matching.widget.config);
			const allEntryNames = [...new Set([...entryNames, ...widgetConfigSchema.parse(widget.config).entryNames])];
			if (allEntryNames.length === entryNames.length) {
				return { ...dashboard, focusedPaneId: matching.id };
			}

			// Keeps any other config fields as they are
			const config = typeof matching.widget.config === 'object' ? matching.widget.config : {};
			const merged = { ...matching.widget, config: { ...config, entryNames: allEntryNames } };
			return { ...dashboard, layout: setPaneWidget(dashboard.layout, matching.id, merged), focusedPaneId: matching.id };
		}

		if (focused.widget === undefined) {
			return { ...dashboard, layout: setPaneWidget(dashboard.layout, focused.id, widget), focusedPaneId: focused.id };
		}

		const preferred = splitDirectionFor(focused.id);
		const directions: SplitDirection[] = [preferred, preferred === 'row' ? 'column' : 'row'];
		const direction = directions.find((other) => canSplitPane(dashboard.layout, focused.id, other));
		// The focused pane's row and column are both full
		if (direction === undefined) {
			return dashboard;
		}

		const newPane = { ...createPane(), widget };
		const layout = splitPane(dashboard.layout, focused.id, direction, newPane);
		return { ...dashboard, layout, focusedPaneId: newPane.id };
	});
}

/** Close a pane and focus the pane that takes its place */
export function closeDashboardPane(id: string, paneId: string): void {
	updateDashboard(id, (dashboard) => {
		const layout = closePane(dashboard.layout, paneId);
		return { ...dashboard, layout, focusedPaneId: firstPane(findSibling(dashboard.layout, paneId) ?? layout).id };
	});
}

/** Close the focused pane, or delete the dashboard if it's down to a single empty pane */
export function closeFocusedPane(id: string): void {
	const dashboard = store.get().find((other) => other.id === id);
	if (!dashboard) {
		return;
	}

	if (dashboard.layout.kind === 'pane' && dashboard.layout.widget === undefined) {
		deleteDashboard(id);
	} else {
		closeDashboardPane(id, getFocusedPane(dashboard).id);
	}
}
