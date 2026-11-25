import { Button } from '@astryxdesign/core/Button';
import { Navigate, createFileRoute, redirect, useRouter } from '@tanstack/react-router';
import LayoutDashboardIcon from 'lucide-react/icons/layout-dashboard';
import PlusIcon from 'lucide-react/icons/plus';
import { PageEmptyState } from '@/components/page-empty-state';
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
		<PageEmptyState
			icon={<LayoutDashboardIcon />}
			title="No dashboards"
			description="Create a dashboard to start adding widgets."
			actions={
				<Button label="New dashboard" variant="primary" icon={<PlusIcon />} onClick={() => newDashboard(router)} />
			}
		/>
	);
}
