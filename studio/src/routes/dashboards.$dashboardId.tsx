import { Navigate, createFileRoute } from '@tanstack/react-router';
import { Group, Panel } from 'react-resizable-panels';
import { DashboardPanes } from '@/components/dashboard-panes';
import { KeyBrowser } from '@/components/key-browser';
import { TimelineBar } from '@/components/timeline-bar';
import { useDashboard } from '@/dashboards';
import { EntryDragProvider } from '@/entry-drag';

export const Route = createFileRoute('/dashboards/$dashboardId')({
	component: DashboardView,
});

function DashboardView() {
	const { dashboardId } = Route.useParams();
	const dashboard = useDashboard(dashboardId);

	// The dashboard was deleted or never existed
	if (!dashboard) {
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
