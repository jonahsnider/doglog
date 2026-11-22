import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useSyncExternalStore } from 'react';
import { Group, Panel } from 'react-resizable-panels';
import { startConnect } from '@/commands/commands';
import { DashboardPanes } from '@/dashboards/dashboard-panes';
import { getDashboard, subscribeDashboards } from '@/dashboards/dashboards';
import { getSource } from '@/data/source';
import { EntryBrowser } from '@/entries/entry-browser';
import { tuningDashboardId } from '@/tuning/dashboard';
import { tuningWidgetType } from '@/widgets/registry';

export const Route = createFileRoute('/tuning')({
	// Loads the tuning widget alongside the page, so its pane doesn't start out with a spinner
	loader: () => tuningWidgetType.preload?.(),
	component: Tuning,
});

function Tuning() {
	// Unlisted dashboards are read when any dashboard changes, they're kept until their own document changes
	const dashboard = useSyncExternalStore(subscribeDashboards, () => getDashboard(tuningDashboardId)!);

	// Tuning only works live, so opening the page connects unless the live session is already shown
	useEffect(() => {
		const shown = getSource();
		if (shown?.type !== 'live' || shown.status === 'disconnected') {
			startConnect();
		}
	}, []);

	return (
		<Group orientation="horizontal" className="h-full">
			<Panel minSize="7rem" style={{ overflow: 'hidden' }}>
				<section aria-label="Tuning" className="relative isolate h-full py-1.5 ps-1.5">
					<DashboardPanes dashboard={dashboard} />
				</section>
			</Panel>
			<EntryBrowser dashboard={dashboard} />
		</Group>
	);
}
