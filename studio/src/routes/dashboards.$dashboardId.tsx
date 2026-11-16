import { Navigate, createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Group, Panel } from 'react-resizable-panels';
import { DashboardPanes } from '@/components/dashboard-panes';
import { KeyBrowser } from '@/components/key-browser';
import { TimelineBar } from '@/components/timeline-bar';
import { useDashboards } from '@/dashboards';
import { EntryDragProvider } from '@/entry-drag';

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
		<div className="flex h-full flex-col">
			<Group orientation="horizontal" className="min-h-0 flex-1">
				<EntryDragProvider>
					<Panel minSize="7rem" style={{ overflow: 'hidden' }}>
						<section aria-label="Panes" className="h-full min-w-0">
							<DashboardPanes dashboard={dashboard} />
						</section>
					</Panel>
					<KeyBrowser />
				</EntryDragProvider>
			</Group>
			<TimelineBar />
		</div>
	);
}
