import { type Dashboard, deleteDashboard, getDashboard, updateDashboard } from '@/dashboards';
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
	setPaneWidget,
	type SplitDirection,
	splitPane,
	type Widget,
} from '@/pane-layout';
import { widgetConfigSchema } from '@/widgets/widget-type';

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
