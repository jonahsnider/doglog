import type { RegisteredRouter } from '@tanstack/react-router';
import { canCopyDashboardLink, copyDashboardLink } from '@/dashboards/copy-dashboard-link';
import { type Dashboard, getDashboard, updateDashboard } from '@/dashboards/dashboards';
import { allowedActions, getFocusedPane, splitDashboardPane, splitDirectionFor, toggleZoom } from '@/dashboards/panes';
import { getSource } from '@/data/source';
import { copyDashboardImage } from '@/desktop/capture';
import { canExportVideo, isExportingVideo, startVideoExport } from '@/desktop/video-export';
import { toggleEditing, toggleEntryBrowser } from '@/entries/editing';
import { balanceLayout, isBalanced, type SplitDirection } from '@/panes/layout';
import { shownTuningDashboard } from '@/tuning/dashboard';
import { getWidgetType } from '@/widgets/registry';
import { bindsEntries } from '@/widgets/widget-type';

// Commands that act on the open dashboard and its focused pane, with whether each can run for the app menu

export function currentDashboard(router: RegisteredRouter): Dashboard | undefined {
	const match = router.state.matches.find((other) => other.routeId === '/dashboards/$dashboardId');
	return match && getDashboard(match.params.dashboardId);
}

/** The dashboard that pane commands act on. Video export mode keeps the layout it previews. */
export function paneCommandDashboard(router: RegisteredRouter): Dashboard | undefined {
	return isExportingVideo() ? undefined : (currentDashboard(router) ?? shownTuningDashboard(router));
}

export function canZoomFocused(router: RegisteredRouter): boolean {
	return paneCommandDashboard(router)?.layout.kind === 'split';
}

export function toggleFocusedZoom(router: RegisteredRouter): void {
	const dashboard = paneCommandDashboard(router);
	if (dashboard) {
		toggleZoom(dashboard.id, getFocusedPane(dashboard).id);
	}
}

export function canEditFocusedEntries(router: RegisteredRouter): boolean {
	const dashboard = paneCommandDashboard(router);
	const widget = dashboard && getFocusedPane(dashboard).widget;
	const type = widget && getWidgetType(widget.type);
	return type !== undefined && bindsEntries(type);
}

export function toggleFocusedEditing(router: RegisteredRouter): void {
	const dashboard = paneCommandDashboard(router);
	if (dashboard && canEditFocusedEntries(router)) {
		toggleEditing(dashboard.id, getFocusedPane(dashboard).id);
	}
}

/** Whether the focused pane has room to split, and its dashboard allows it, ex. the Tuning page's tuning pane doesn't */
export function canSplitFocused(router: RegisteredRouter, direction: SplitDirection): boolean {
	const dashboard = paneCommandDashboard(router);
	if (!dashboard) {
		return false;
	}
	const allowed = allowedActions(dashboard.id, dashboard.layout, getFocusedPane(dashboard).id);
	return direction === 'row' ? allowed.splitRight : allowed.splitDown;
}

/** The new pane goes after the focused pane, or before it with `before` */
export function splitFocused(router: RegisteredRouter, direction: SplitDirection, before = false): void {
	const dashboard = paneCommandDashboard(router);
	if (dashboard && canSplitFocused(router, direction)) {
		splitDashboardPane(dashboard.id, getFocusedPane(dashboard).id, direction, before);
	}
}

export function canSplitFocusedBestFit(router: RegisteredRouter): boolean {
	return canSplitFocused(router, 'row') || canSplitFocused(router, 'column');
}

/** Splits along the focused pane's longer side, or its shorter side when that row or column is full */
export function splitFocusedBestFit(router: RegisteredRouter): void {
	const dashboard = paneCommandDashboard(router);
	if (!dashboard) {
		return;
	}
	const preferred = splitDirectionFor(getFocusedPane(dashboard).id);
	const directions: SplitDirection[] = [preferred, preferred === 'row' ? 'column' : 'row'];
	const direction = directions.find((other) => canSplitFocused(router, other));
	if (direction) {
		splitFocused(router, direction);
	}
}

/** Whether the dashboard has resized panes to balance */
export function canBalancePanes(router: RegisteredRouter): boolean {
	const dashboard = paneCommandDashboard(router);
	return dashboard !== undefined && !isBalanced(dashboard.layout);
}

/** Undo every resize in the dashboard, so its panes share the space evenly */
export function balancePanes(router: RegisteredRouter): void {
	const dashboard = paneCommandDashboard(router);
	if (dashboard) {
		updateDashboard(dashboard.id, (current) => ({ ...current, layout: balanceLayout(current.layout) }));
	}
}

/** The entry browser is only shown beside a dashboard */
export function canToggleEntryBrowser(router: RegisteredRouter): boolean {
	return (currentDashboard(router) ?? shownTuningDashboard(router)) !== undefined;
}

export function toggleDashboardEntryBrowser(router: RegisteredRouter): void {
	if (canToggleEntryBrowser(router)) {
		toggleEntryBrowser();
	}
}

/** Whether the open dashboard has widgets to link to or capture */
export function canCopyCurrentDashboard(router: RegisteredRouter): boolean {
	const dashboard = currentDashboard(router);
	return dashboard !== undefined && canCopyDashboardLink(dashboard);
}

/** Returns whether the open dashboard had a link to copy */
export function copyCurrentDashboardLink(router: RegisteredRouter): boolean {
	const dashboard = currentDashboard(router);
	if (!dashboard || !canCopyDashboardLink(dashboard)) {
		return false;
	}
	void copyDashboardLink(dashboard);
	return true;
}

export function copyCurrentDashboardImage(router: RegisteredRouter): void {
	const dashboard = currentDashboard(router);
	if (dashboard && canCopyDashboardLink(dashboard)) {
		void copyDashboardImage(router, dashboard.id);
	}
}

export function canExportCurrentDashboardVideo(router: RegisteredRouter): boolean {
	const dashboard = currentDashboard(router);
	return dashboard !== undefined && !isExportingVideo() && canExportVideo(dashboard, getSource());
}

export function exportCurrentDashboardVideo(router: RegisteredRouter): void {
	const dashboard = currentDashboard(router);
	if (dashboard) {
		startVideoExport(router, dashboard.id);
	}
}
