import { createFileRoute, redirect } from '@tanstack/react-router';
import { dashboards } from '@/dashboards';

export const Route = createFileRoute('/')({
	beforeLoad: () => {
		const [dashboard] = dashboards;

		if (dashboard) {
			throw redirect({ to: '/dashboards/$dashboardId', params: { dashboardId: dashboard.id } });
		}
	},
});
