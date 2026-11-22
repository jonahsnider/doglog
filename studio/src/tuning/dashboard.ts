import type { RegisteredRouter } from '@tanstack/react-router';
import { type Dashboard, getDashboard, getDoc } from '@/dashboards/dashboards';
import { updateLayout } from '@/dashboards/panes';
import { addUnlistedDashboard } from '@/dashboards/unlisted';
import { createId } from '@/lib/random-id';
import { createPane, type PaneNode } from '@/panes/layout';
import { createWidget } from '@/widgets/bindings';
import { getWidgetType, tuningWidgetType } from '@/widgets/registry';

/** The Tuning page's panes, saved like a dashboard that isn't in the sidebar */
export const tuningDashboardId = 'tuning-panes';

function isTuningPane(node: PaneNode): boolean {
	return node.kind === 'pane' && node.widget?.type === tuningWidgetType.id;
}

/** Panes that can go beside the tuning pane: one, or two stacked */
function allowsOthers(node: PaneNode): boolean {
	return node.kind === 'pane'
		? !isTuningPane(node)
		: node.direction === 'column' &&
				node.children.length === 2 &&
				node.children.every((child) => child.kind === 'pane' && !isTuningPane(child));
}

/** The tuning pane on the left, the only one, and the other panes beside it */
function allowsLayout(layout: PaneNode): boolean {
	return (
		layout.kind === 'split' &&
		layout.direction === 'row' &&
		layout.children.length === 2 &&
		isTuningPane(layout.children[0]!) &&
		allowsOthers(layout.children[1]!)
	);
}

/** Put the tuning pane on the left of `others` */
function withTuningPane(others: PaneNode): PaneNode {
	return {
		kind: 'split',
		id: createId(),
		direction: 'row',
		children: [
			{ ...createPane(), widget: createWidget(tuningWidgetType) },
			{ ...others, size: undefined },
		],
	};
}

addUnlistedDashboard(tuningDashboardId, allowsLayout);
getDoc(tuningDashboardId, {
	name: 'Tuning',
	layout: withTuningPane({ ...createPane(), widget: createWidget(getWidgetType('graph')!) }),
});
// Saved before the tuning panel was a pane, when the dashboard only had the panes beside it
const { layout } = getDashboard(tuningDashboardId)!;
if (!allowsLayout(layout) && allowsOthers(layout)) {
	updateLayout(tuningDashboardId, withTuningPane);
}

/** The Tuning page's panes while it's shown, so pane shortcuts act on them */
export function shownTuningDashboard(router: RegisteredRouter): Dashboard | undefined {
	return router.state.matches.some(({ routeId }) => routeId === '/tuning')
		? getDashboard(tuningDashboardId)
		: undefined;
}
