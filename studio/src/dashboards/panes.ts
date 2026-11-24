import { createContext } from 'react';
import { toastManager } from '@/components/ui/toast';
import { addEntries, dropEntry, type EntryDrop, widgetBindings, WidgetEntryLimitError } from '@/widgets/bindings';
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
import { allowsLayout } from '@/dashboards/unlisted';
import { canShareDashboards, placeDashboard, shareDashboards } from '@/dashboards/sharing';
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
import { droppedEntryName, droppedGroupNames, type EntryDragData } from '@/entries/drag';
import { acceptsDrop, bindsEntries } from '@/widgets/widget-type';

/** The layout of the dashboard showing a widget, so widgets can follow others, see `WidgetProps.layout` */
export const DashboardLayoutContext = createContext<PaneNode>(createPane());

/** The dashboard the entry browser or a widget is acting on */
export const DashboardIdContext = createContext('');

/**
 * Change a dashboard's pane layout from the UI, showing feedback if the widget entry limit rejects the change.
 * @example updateLayout(dashboardId, (layout) => setPaneWidget(layout, paneId, widget))
 */
export function updateLayout(id: string, update: (layout: PaneNode) => PaneNode): void {
	updateDashboardEntries(id, (dashboard) => ({ ...dashboard, layout: update(dashboard.layout) }));
}

/** Show limit feedback for user actions without committing a rejected change. */
function updateDashboardEntries(id: string, update: (dashboard: Dashboard) => Dashboard): void {
	try {
		updateDashboard(id, update);
	} catch (error) {
		if (!(error instanceof WidgetEntryLimitError)) {
			throw error;
		}
		toastManager.add({ type: 'warning', title: 'Couldn’t add to widget', description: error.message });
	}
}

/**
 * Bind the entries dropped on a pane's widget, or pick its option when a single entry is dropped (see `optionFromEntry`).
 */
export function dropDashboardEntry(id: string, dragged: EntryDragData, to: EntryDrop): void {
	updateLayout(id, (layout) => {
		const widget = findPane(layout, to.paneId)?.widget;
		const type = widget && getWidgetType(widget.type);
		if (!type) {
			return layout;
		}
		if (dragged.group) {
			return addEntries(layout, to.paneId, droppedGroupNames(type, dragged.group));
		}
		const name = droppedEntryName(type, dragged);
		if (!acceptsDrop(type, name, getEntry(name))) {
			return layout;
		}
		const { paneId, bindingId } = dragged;
		const from = paneId !== undefined && bindingId !== undefined ? { paneId, bindingId } : undefined;
		const option = type.optionFromEntry?.(name);
		return option ? setWidgetOption(layout, to.paneId, option.id, option.value) : dropEntry(layout, { name, from }, to);
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

/** Whether closing a pane leaves a layout its dashboard allows */
function canClose(id: string, layout: PaneNode, paneId: string): boolean {
	return allowsLayout(id, closePane(layout, paneId));
}

/** What a pane's dashboard allows doing to it, ex. the Tuning page's tuning pane can't be split, closed, moved, or show another widget */
export function allowedActions(id: string, layout: PaneNode, paneId: string) {
	const right = allowsLayout(id, splitPane(layout, paneId, 'row'));
	const down = allowsLayout(id, splitPane(layout, paneId, 'column'));
	const close = canClose(id, layout, paneId);
	return {
		splitRight: right && canSplitPane(layout, paneId, 'row'),
		splitDown: down && canSplitPane(layout, paneId, 'column'),
		// Show the controls even when the row or column is full
		splittable: right || down,
		close,
		// Dragging a pane takes it out of its place, like closing it
		move: close,
		changeWidget: allowsLayout(id, setPaneWidget(layout, paneId, undefined)),
	};
}

/** Split a pane and focus the new pane, if the layout has room for it */
export function splitDashboardPane(id: string, paneId: string, direction: SplitDirection): void {
	updateDashboard(id, (dashboard) => {
		if (!canSplitPane(dashboard.layout, paneId, direction)) {
			return dashboard;
		}

		const newPane = createPane();
		return {
			...dashboard,
			layout: splitPane(dashboard.layout, paneId, direction, newPane),
			focusedPaneId: newPane.id,
		};
	});
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
	updateDashboardEntries(id, (dashboard) => {
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
	if (!dashboard || !pane || (dashboard.layout.kind === 'split' && !canClose(id, dashboard.layout, paneId))) {
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

	if (shared && !canShareDashboards()) {
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
