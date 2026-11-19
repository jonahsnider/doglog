import { Navigate, createFileRoute, redirect, useRouter } from '@tanstack/react-router';
import LayoutDashboardIcon from 'lucide-react/icons/layout-dashboard';
import PlusIcon from 'lucide-react/icons/plus';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { newDashboard } from '@/commands/commands';
import { getDashboards, useDashboards } from '@/dashboards/dashboards';

export const Route = createFileRoute('/')({
	beforeLoad: () => {
		const [dashboard] = getDashboards();
		return dashboard
			? redirect({ to: '/dashboards/$dashboardId', params: { dashboardId: dashboard.id }, replace: true })
			: undefined;
	},
	component: Index,
});

function Index() {
	const [dashboard] = useDashboards();
	const router = useRouter();

	// Another window can add a dashboard while this one is on the empty page.
	if (dashboard) {
		return <Navigate to="/dashboards/$dashboardId" params={{ dashboardId: dashboard.id }} replace />;
	}

	return (
		<Empty className="h-full">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<LayoutDashboardIcon />
				</EmptyMedia>
				<EmptyTitle>No dashboards</EmptyTitle>
				<EmptyDescription>Create a dashboard to start adding widgets.</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button onClick={() => newDashboard(router)}>
					<PlusIcon />
					New dashboard
				</Button>
			</EmptyContent>
		</Empty>
	);
}
