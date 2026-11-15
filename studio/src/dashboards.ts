import { useSelector } from '@tanstack/react-store';
import * as z from 'zod';
import { createPersistedAtom } from '@/lib/persisted-store';
import {
	closePane,
	createPane,
	findPane,
	findSibling,
	firstPane,
	type Pane,
	type PaneNode,
	paneNodeSchema,
	type SplitDirection,
	splitPane,
} from '@/pane-layout';

const dashboardSchema = z.object({
	id: z.string(),
	name: z.string(),
	layout: paneNodeSchema.catch(() => createPane()),
	/** The pane the user last interacted with, use `getFocusedPane()` since it can be outdated */
	focusedPaneId: z.string().optional().catch(undefined),
});

export type Dashboard = z.infer<typeof dashboardSchema>;

// Invalid dashboards are dropped instead of resetting every dashboard
const dashboardsSchema = z
	.array(dashboardSchema.nullable().catch(null))
	.transform((dashboards) => dashboards.filter((dashboard) => dashboard !== null));

function newDashboard(name: string): Dashboard {
	return { id: crypto.randomUUID(), name, layout: createPane() };
}

/** Dashboards in sidebar order, first launch starts with one empty dashboard */
const store = createPersistedAtom('dashboards', dashboardsSchema, [newDashboard('Dashboard 1')]);

export function useDashboards(): Dashboard[] {
	return useSelector(store);
}

export function useDashboard(id: string): Dashboard | undefined {
	return useDashboards().find((dashboard) => dashboard.id === id);
}

/** Create an empty, auto-named dashboard at the top of the list */
export function createDashboard(): Dashboard {
	const names = new Set(store.get().map((dashboard) => dashboard.name));
	let number = 1;
	while (names.has(`Dashboard ${number}`)) {
		number++;
	}

	const dashboard = newDashboard(`Dashboard ${number}`);
	store.set((dashboards) => [dashboard, ...dashboards]);
	return dashboard;
}

function updateDashboard(id: string, update: (dashboard: Dashboard) => Dashboard): void {
	store.set((dashboards) => dashboards.map((dashboard) => (dashboard.id === id ? update(dashboard) : dashboard)));
}

/** Blank names are ignored */
export function renameDashboard(id: string, name: string): void {
	const trimmed = name.trim();
	if (trimmed !== '') {
		updateDashboard(id, (dashboard) => ({ ...dashboard, name: trimmed }));
	}
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

export function deleteDashboard(id: string): void {
	store.set((dashboards) => dashboards.filter((dashboard) => dashboard.id !== id));
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
