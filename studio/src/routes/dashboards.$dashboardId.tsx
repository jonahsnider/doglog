import { useDragDropMonitor } from '@dnd-kit/react';
import { Navigate, createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Group, Panel } from 'react-resizable-panels';
import { DashboardPanes } from '@/dashboards/dashboard-panes';
import { EntryBrowser } from '@/entries/entry-browser';
import { TimelineBar } from '@/timeline/timeline-bar';
import { useDashboards } from '@/dashboards/dashboards';
import { cn } from '@/lib/utils';
import { isPaneDrag } from '@/panes/drag';
import { setViewedDashboard } from '@/sharing/presence';
import { useNamePrompt } from '@/sharing/name-prompt';

export const Route = createFileRoute('/dashboards/$dashboardId')({
	component: DashboardView,
});

function DashboardView() {
	const { dashboardId } = Route.useParams();
	const dashboards = useDashboards();
	const index = dashboards.findIndex((other) => other.id === dashboardId);
	const dashboard = dashboards[index];
	// Remembered so closing this dashboard can select the one that took its place in the sidebar
	const [lastIndex, setLastIndex] = useState(index);
	// While a pane is moved, other panes are only drop targets. Without pointer events they can't be hovered, and dnd-kit
	// doesn't auto-scroll them when the pointer nears their edges, since it scrolls the element under the pointer.
	const [movingPane, setMovingPane] = useState(false);
	useDragDropMonitor({
		onDragStart: ({ operation }) => setMovingPane(isPaneDrag(operation.source)),
		onDragEnd: () => setMovingPane(false),
	});
	// Others in a shared dashboard see this window in it
	useEffect(() => {
		setViewedDashboard(dashboardId);
		return () => setViewedDashboard(undefined);
	}, [dashboardId]);
	useNamePrompt(dashboard?.shared === true);
	if (index !== -1 && index !== lastIndex) {
		setLastIndex(index);
	}

	if (!dashboard) {
		// Like closing a browser tab, select the next dashboard, or the previous one if this was the last
		const neighbor = lastIndex === -1 ? undefined : dashboards[Math.min(lastIndex, dashboards.length - 1)];
		if (neighbor) {
			return <Navigate to="/dashboards/$dashboardId" params={{ dashboardId: neighbor.id }} replace />;
		}

		// The dashboard never existed, or every dashboard was deleted
		return <Navigate to="/" replace />;
	}

	return (
		<div className={cn('flex h-full flex-col', movingPane && 'pointer-events-none')}>
			<Group orientation="horizontal" className="min-h-0 flex-1">
				<Panel minSize="7rem" style={{ overflow: 'hidden' }}>
					<section aria-label="Panes" className="h-full min-w-0">
						<DashboardPanes dashboard={dashboard} />
					</section>
				</Panel>
				<EntryBrowser />
			</Group>
			<TimelineBar />
		</div>
	);
}
