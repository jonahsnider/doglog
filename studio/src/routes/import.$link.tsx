import { Link, createFileRoute, redirect } from '@tanstack/react-router';
import { isTauri } from '@tauri-apps/api/core';
import LinkIcon from 'lucide-react/icons/link';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { dashboardSnapshot, decodeDashboardLink, snapshotKey } from '@/dashboards/dashboard-link';
import { createDashboard, getDashboards } from '@/dashboards/dashboards';
import { openDashboardLinkInDesktop } from '@/dashboards/open-dashboard-link';
import { restoreLayout } from '@/panes/layout-snapshot';

export const Route = createFileRoute('/import/$link')({
	beforeLoad: async ({ params, preload, abortController }) => {
		if (preload) {
			return undefined;
		}
		const snapshot = await decodeDashboardLink(params.link).catch(() => undefined);
		if (abortController.signal.aborted || snapshot === undefined) {
			return undefined;
		}
		// Also imported here, so the dashboard opens in the browser if the user doesn't open the desktop app
		if (!isTauri()) {
			openDashboardLinkInDesktop(params.link);
		}
		const key = snapshotKey(snapshot);
		const existing = getDashboards().find(
			(dashboard) =>
				!dashboard.shared && dashboard.name === snapshot.name && snapshotKey(dashboardSnapshot(dashboard)) === key,
		);
		const { id } = existing ?? createDashboard('top', { name: snapshot.name, layout: restoreLayout(snapshot.layout) });
		return redirect({ to: '/dashboards/$dashboardId', params: { dashboardId: id }, replace: true });
	},
	component: InvalidDashboardLink,
});

function InvalidDashboardLink() {
	return (
		<Empty className="h-full">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<LinkIcon />
				</EmptyMedia>
				<EmptyTitle>Couldn’t open dashboard link</EmptyTitle>
				<EmptyDescription>The link is invalid or unsupported.</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button render={<Link to="/" replace />}>Back to dashboards</Button>
			</EmptyContent>
		</Empty>
	);
}
