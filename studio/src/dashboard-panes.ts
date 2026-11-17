import {
	createDashboard,
	type Dashboard,
	deleteDashboard,
	getDashboard,
	getDashboards,
	moveDashboard,
	updateDashboard,
} from '@/dashboards';
import { getEntry } from '@/data/data-store';
import {
	canJoinLayouts,
	canSplitPane,
	closePane,
	createPane,
	dropEntry,
	type EntryDrop,
	findPane,
	findSibling,
	findWidgetPane,
	firstPane,
	joinLayouts,
	movePane,
	type Pane,
	type PaneNode,
	type PaneSide,
	setPaneEntryNames,
	setPaneWidget,
	type SplitDirection,
	splitPane,
	type Widget,
} from '@/pane-layout';
import { getWidgetType } from '@/widgets/registry';
import { acceptsEntry, widgetConfigSchema } from '@/widgets/widget-type';

/**
 * Change a dashboard's pane layout with one of the `@/pane-layout` operations.
 * @example updateLayout(dashboardId, (layout) => setPaneWidget(layout, paneId, widget))
 */
export function updateLayout(id: string, update: (layout: PaneNode) => PaneNode): void {
	updateDashboard(id, (dashboard) => ({ ...dashboard, layout: update(dashboard.layout) }));
}

/** Bind an entry dropped on a pane's widget if the widget accepts it, see `dropEntry()` */
export function dropDashboardEntry(id: string, name: string, fromPaneId: string | undefined, to: EntryDrop): void {
	const entry = getEntry(name);
	updateLayout(id, (layout) => {
		const widget = findPane(layout, to.paneId)?.widget;
		const type = widget && getWidgetType(widget.type);
		// Entries missing from the source might be accepted once they're loaded
		return type && (entry === undefined || acceptsEntry(type, entry))
			? dropEntry(layout, name, fromPaneId, to)
			: layout;
	});
}

/** The pane that keyboard shortcuts act on, the first pane if the focused pane is gone */
export function getFocusedPane(dashboard: Dashboard): Pane {
	const focused =
		dashboard.focusedPaneId === undefined ? undefined : findPane(dashboard.layout, dashboard.focusedPaneId);
	return focused ?? firstPane(dashboard.layout);
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

			return {
				...dashboard,
				layout: setPaneEntryNames(dashboard.layout, matching.id, allEntryNames),
				focusedPaneId: matching.id,
			};
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
	if (!other || !dashboard || id === otherId || !canJoinLayouts(dashboard.layout, other.layout)) {
		return;
	}

	updateDashboard(id, (current) => ({
		...current,
		layout: side === 'left' ? joinLayouts(other.layout, current.layout) : joinLayouts(current.layout, other.layout),
		focusedPaneId: getFocusedPane(other).id,
	}));
	deleteDashboard(otherId);
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
 * Move a pane out of a dashboard into a new dashboard at `index` in the sidebar.
 * The only pane moves its whole dashboard to `index` instead.
 */
export function movePaneToNewDashboard(id: string, paneId: string, index: number): void {
	const dashboard = getDashboard(id);
	const pane = dashboard && findPane(dashboard.layout, paneId);
	if (!dashboard || !pane) {
		return;
	}

	if (dashboard.layout.kind === 'pane') {
		// `index` counts the dashboard itself, which is taken out of the list before it's moved
		const from = getDashboards().findIndex((other) => other.id === id);
		moveDashboard(id, index > from ? index - 1 : index);
		return;
	}

	const created = createDashboard();
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
