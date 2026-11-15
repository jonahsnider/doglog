import { Navigate, createFileRoute, useRouter } from '@tanstack/react-router';
import { LayoutDashboardIcon, PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { newDashboard } from '@/commands';
import { useDashboards } from '@/dashboards';

export const Route = createFileRoute('/')({
	component: Index,
});

function Index() {
	const [dashboard] = useDashboards();
	const router = useRouter();

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
