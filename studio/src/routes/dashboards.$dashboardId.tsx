import { Navigate, createFileRoute } from '@tanstack/react-router';
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
			<div className="flex min-h-0 flex-1">
				<EntryDragProvider>
					<section aria-label="Panes" className="min-w-0 flex-1">
						<DashboardPanes dashboardId={dashboard.id} layout={dashboard.layout} />
					</section>
					<KeyBrowser />
				</EntryDragProvider>
			</div>
			<TimelineBar />
		</div>
	);
}
