import { addEntries, type DraggedEntry, dropEntry, type EntryDrop, widgetBindings } from '@/widgets/bindings';
import {
	createDashboard,
	type Dashboard,
	deleteDashboard,
	deleteDashboards,
	getDashboard,
	getDashboards,
	moveDashboard,
	updateDashboard,
} from '@/dashboards/dashboards';
import { focusPane, zoomPane } from '@/dashboards/pane-state';
import { placeDashboard, shareDashboards } from '@/dashboards/sharing';
import { getEntry } from '@/data/data-store';
import {
	canJoinLayouts,
	canSplitPane,
	closePane,
	createPane,
	findPane,
	findSibling,
	firstPane,
	joinLayouts,
	movePane,
	type Pane,
	panes,
	type PaneNode,
	type PaneSide,
	setPaneWidget,
	type SplitDirection,
	splitPane,
	type Widget,
} from '@/panes/layout';
import { getWidgetType } from '@/widgets/registry';
import { optionValues, setWidgetOption } from '@/widgets/options';
import { droppedEntryName } from '@/entries/drag';
import { acceptsDrop, bindsEntries } from '@/widgets/widget-type';

/**
 * Change a dashboard's pane layout with one of the `@/panes/layout` operations.
 * @example updateLayout(dashboardId, (layout) => setPaneWidget(layout, paneId, widget))
 */
export function updateLayout(id: string, update: (layout: PaneNode) => PaneNode): void {
	updateDashboard(id, (dashboard) => ({ ...dashboard, layout: update(dashboard.layout) }));
}

/**
 * Bind an entry dropped on a pane's widget if the widget accepts it (see `dropEntry()`), or pick the option the widget
 * picks from it, see `WidgetType.optionFromEntry`
 */
export function dropDashboardEntry(id: string, dragged: DraggedEntry, to: EntryDrop): void {
	updateLayout(id, (layout) => {
		const widget = findPane(layout, to.paneId)?.widget;
		const type = widget && getWidgetType(widget.type);
		const name = type && droppedEntryName(type, dragged);
		if (!type || name === undefined || !acceptsDrop(type, name, getEntry(name))) {
			return layout;
		}
		const option = type.optionFromEntry?.(name);
		return option
			? setWidgetOption(layout, to.paneId, option.id, option.value)
			: dropEntry(layout, { ...dragged, name }, to);
	});
}

/** The pane that keyboard shortcuts act on, the first pane if the focused pane is gone */
export function getFocusedPane(dashboard: Dashboard): Pane {
	const focused =
		dashboard.focusedPaneId === undefined ? undefined : findPane(dashboard.layout, dashboard.focusedPaneId);
	return focused ?? firstPane(dashboard.layout);
}

/** The pane filling the dashboard, `undefined` if it's gone or the only pane */
export function getZoomedPane(dashboard: Dashboard): Pane | undefined {
	const { layout, zoomedPaneId } = dashboard;
	return layout.kind === 'split' && zoomedPaneId !== undefined ? findPane(layout, zoomedPaneId) : undefined;
}

/** Zoom a pane to fill the dashboard and focus it, or restore the other panes if it's already zoomed */
export function toggleZoom(id: string, paneId: string): void {
	const dashboard = getDashboard(id);
	if (!dashboard || dashboard.layout.kind === 'pane') {
		return;
	}

	const zoomed = getZoomedPane(dashboard)?.id === paneId;
	zoomPane(id, zoomed ? undefined : paneId);
	focusPane(id, paneId);
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
export function splitDirectionFor(paneId: string): SplitDirection {
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
		const type = getWidgetType(widget.type);
		// Widgets without entries are only the same when their options are, ex. controllers on the same port
		const options = (other: Widget) => type && JSON.stringify(optionValues(type, other, []));
		const same = (pane: Pane) =>
			pane.widget?.type === widget.type &&
			(type === undefined || bindsEntries(type) || options(pane.widget) === options(widget));
		const matching = same(focused) ? focused : panes(dashboard.layout).find((pane) => same(pane));
		if (matching?.widget !== undefined) {
			const names = widgetBindings(widget).map((binding) => binding.name);
			return { ...dashboard, layout: addEntries(dashboard.layout, matching.id, names), focusedPaneId: matching.id };
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

/**
 * Move another dashboard's panes into a dashboard, beside its own panes on `side`, and close the other dashboard.
 * Does nothing if the panes wouldn't fit, see `canJoinLayouts()`.
 */
export function combineDashboards(id: string, otherId: string, side: 'left' | 'right'): void {
	const other = getDashboard(otherId);
	const dashboard = getDashboard(id);
	if (!other || !dashboard || id === otherId || !canJoinLayouts([dashboard.layout, other.layout])) {
		return;
	}

	updateDashboard(id, (current) => ({
		...current,
		layout: joinLayouts(side === 'left' ? [other.layout, current.layout] : [current.layout, other.layout]),
		focusedPaneId: getFocusedPane(other).id,
	}));
	deleteDashboard(otherId);
}

/**
 * Put dashboards' panes side by side in the first of them, in order, and close the others.
 * Does nothing if the panes wouldn't fit, see `canJoinLayouts()`.
 */
export function splitDashboards(ids: readonly string[]): void {
	const dashboards = ids.flatMap((id) => getDashboard(id) ?? []);
	const [first, ...others] = dashboards;
	const layouts = dashboards.map((dashboard) => dashboard.layout);
	if (!first || others.length === 0 || !canJoinLayouts(layouts)) {
		return;
	}

	updateDashboard(first.id, (current) => ({ ...current, layout: joinLayouts(layouts) }));
	deleteDashboards(others.map((other) => other.id));
}

/** Move a pane beside another pane and focus it, see `movePane()` */
export function moveDashboardPane(id: string, paneId: string, targetId: string, side: PaneSide): void {
	updateDashboard(id, (dashboard) => ({
		...dashboard,
		layout: movePane(dashboard.layout, paneId, targetId, side),
		focusedPaneId: paneId,
	}));
}

/**
 * Move a pane out of a dashboard into a new dashboard at `index` among the shared dashboards or the others.
 * The only pane moves its whole dashboard there instead.
 */
export function movePaneToNewDashboard(id: string, paneId: string, shared: boolean, index: number): void {
	const dashboard = getDashboard(id);
	const pane = dashboard && findPane(dashboard.layout, paneId);
	if (!dashboard || !pane) {
		return;
	}

	if (dashboard.layout.kind === 'pane') {
		// `index` counts the dashboard itself when it's already there, it's taken out of the list before it's moved
		const from = getDashboards()
			.filter((other) => other.shared === shared)
			.findIndex((other) => other.id === id);
		placeDashboard(id, shared, from !== -1 && index > from ? index - 1 : index);
		return;
	}

	const created = createDashboard();
	if (shared) {
		shareDashboards([created.id]);
	}
	moveDashboard(created.id, index);
	updateDashboard(created.id, (other) => ({ ...other, layout: pane, focusedPaneId: pane.id }));
	closeDashboardPane(id, paneId);
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
	const dashboard = getDashboard(id);
	if (!dashboard) {
		return;
	}

	if (dashboard.layout.kind === 'pane' && dashboard.layout.widget === undefined) {
		deleteDashboard(id);
	} else {
		closeDashboardPane(id, getFocusedPane(dashboard).id);
	}
}
