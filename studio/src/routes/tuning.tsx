import { spacingVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
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

const styles = stylex.create({
	fill: { height: '100%' },
	panes: {
		position: 'relative',
		isolation: 'isolate',
		height: '100%',
		paddingBlock: spacingVars['--spacing-1-5'],
		paddingInlineStart: spacingVars['--spacing-1-5'],
	},
});

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
		<Group orientation="horizontal" {...stylex.props(styles.fill)}>
			<Panel minSize="7rem" style={{ overflow: 'hidden' }}>
				<section aria-label="Tuning" {...stylex.props(styles.panes)}>
					<DashboardPanes dashboard={dashboard} />
				</section>
			</Panel>
			<EntryBrowser dashboard={dashboard} />
		</Group>
	);
}
