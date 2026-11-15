import { useSelector } from '@tanstack/react-store';
import * as z from 'zod';
import { createPersistedAtom } from '@/lib/persisted-store';
import { createPane, type PaneNode, paneNodeSchema } from '@/pane-layout';

const dashboardSchema = z.object({
	id: z.string(),
	name: z.string(),
	layout: paneNodeSchema.catch(() => createPane()),
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
