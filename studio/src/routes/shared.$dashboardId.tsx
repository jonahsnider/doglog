import { Center } from '@astryxdesign/core/Center';
import { Spinner } from '@astryxdesign/core/Spinner';
import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useConvexAuth, useQuery } from 'convex/react';
import { useEffect, useState } from 'react';
import { cloudScope } from '@/cloud/session';
import { CloudSignIn } from '@/cloud/sign-in';
import { DashboardLinkError } from '@/dashboards/dashboard-link-error';
import { getSharing, idsStore, useDashboards } from '@/dashboards/dashboards';
import { openDashboardLinkInDesktop } from '@/dashboards/open-dashboard-link';
import { dashboardIdPattern } from '@/link-previews/dashboard-link-preview';
import { api } from '../../../cloud/convex/_generated/api.js';

export const Route = createFileRoute('/shared/$dashboardId')({
	beforeLoad: ({ params: { dashboardId }, preload }) => {
		if (!STUDIO_DESKTOP && !preload && dashboardIdPattern.test(dashboardId)) {
			openDashboardLinkInDesktop(dashboardId);
		}
	},
	component: SharedDashboardLink,
});

function SharedDashboardLink() {
	const { dashboardId } = Route.useParams();
	const { isLoading, isAuthenticated } = useConvexAuth();
	if (!dashboardIdPattern.test(dashboardId)) {
		return <DashboardLinkError />;
	}
	if (isLoading) {
		return <OpeningDashboard />;
	}
	if (!isAuthenticated) {
		return <CloudSignIn description="Use your team account to open this dashboard." />;
	}
	return <OpenCloudDashboard key={dashboardId} dashboardId={dashboardId} />;
}

function OpenCloudDashboard({ dashboardId }: { dashboardId: string }) {
	const team = useQuery(api.teams.getMine);
	const available = useQuery(api.cloudDashboards.list);
	const dashboards = useDashboards();
	const [timedOut, setTimedOut] = useState(false);
	useEffect(() => {
		const timer = setTimeout(() => setTimedOut(true), 15_000);
		return () => clearTimeout(timer);
	}, []);

	if (team !== undefined && available !== undefined) {
		const sharing = idsStore.get().includes(dashboardId) ? getSharing(dashboardId) : undefined;
		if (
			!team ||
			available?.some((dashboard) => dashboard.dashboardId === dashboardId) !== true ||
			(sharing && (sharing.scope !== cloudScope(team.id) || sharing.deletedAt !== undefined))
		) {
			return <DashboardLinkError description="This dashboard is unavailable or you don’t have access to it." />;
		}
		// Cloud sync downloads and decrypts it on a fresh device. Open that same dashboard, not a copy.
		if (dashboards.some((dashboard) => dashboard.id === dashboardId)) {
			return <Navigate to="/dashboards/$dashboardId" params={{ dashboardId }} replace />;
		}
	}

	if (timedOut) {
		return <DashboardLinkError description="Check your connection and device approval in Cloud, then try again." />;
	}
	return <OpeningDashboard />;
}

function OpeningDashboard() {
	return (
		<Center height="100%" role="status">
			<Spinner size="lg" label="Opening shared dashboard…" />
		</Center>
	);
}
