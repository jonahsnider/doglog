import { spacingVars } from '@astryxdesign/core/theme/tokens.stylex';
import { useDragDropMonitor } from '@dnd-kit/react';
import * as stylex from '@stylexjs/stylex';
import { useHotkey } from '@tanstack/react-hotkeys';
import { Navigate, createFileRoute, useLocation } from '@tanstack/react-router';
import { Activity, useEffect, useState } from 'react';
import { Group, Panel } from 'react-resizable-panels';
import { shortcuts } from '@/commands/commands';
import { canCopyDashboardLink } from '@/dashboards/copy-dashboard-link';
import { DashboardSplitZones } from '@/dashboards/dashboard-drag';
import { DashboardPanes } from '@/dashboards/dashboard-panes';
import { canCapture, copyImage, dashboardCaptureTarget } from '@/desktop/capture';
import { useVideoExport } from '@/desktop/video-export';
import { getEntry } from '@/data/data-store';
import { VideoExportBar } from '@/timeline/video-export-bar';
import { EntryBrowser } from '@/entries/entry-browser';
import { TimelineBar } from '@/timeline/timeline-bar';
import { type Dashboard, getDashboard, useDashboards } from '@/dashboards/dashboards';
import { isPaneDrag } from '@/panes/drag';
import { panes } from '@/panes/layout';
import { minNodeSize } from '@/panes/pane-size';
import { setViewedDashboard } from '@/sharing/presence';
import { useNamePrompt } from '@/sharing/name-prompt';
import { resolveBindings, widgetBindings } from '@/widgets/bindings';
import { preloadField3d } from '@/widgets/field/load-3d';
import { useMobileLayout } from '@/lib/mobile-layout';
import { optionValues } from '@/widgets/options';
import { getWidgetType } from '@/widgets/registry';
import './dashboards.$dashboardId.css';

const styles = stylex.create({
	fill: { height: '100%' },
	movingPane: { pointerEvents: 'none' },
	column: { display: 'flex', flexDirection: 'column', height: '100%' },
	capture: {
		display: 'flex',
		flex: 1,
		flexDirection: 'column',
		minHeight: 0,
		paddingInlineStart: spacingVars['--spacing-1-5'],
		paddingTop: spacingVars['--spacing-1-5'],
	},
	// Panes fill the screen below the top bar instead of floating on the frame
	mobileCapture: {
		paddingInlineStart: 0,
		paddingTop: 0,
	},
	panes: {
		position: 'relative',
		isolation: 'isolate',
		flex: 1,
		minWidth: 0,
		minHeight: 0,
		marginBottom: spacingVars['--spacing-1-5'],
	},
});

declare module '@tanstack/react-router' {
	interface HistoryState {
		/** The page a new dashboard was opened from, which closing it returns to */
		opener?: { pathname: string; dashboardId?: string };
	}
}

function has3dWidget(dashboard: Dashboard, kind: 'field' | 'robot'): boolean {
	const type = getWidgetType(kind)!;
	return panes(dashboard.layout).some(({ widget }) => {
		if (widget?.type !== kind) {
			return false;
		}
		const bindings = resolveBindings(type, widgetBindings(widget), getEntry);
		return optionValues(type, widget, bindings)['view'] === '3d';
	});
}

export const Route = createFileRoute('/dashboards/$dashboardId')({
	loader: async ({ params }) => {
		const dashboard = getDashboard(params.dashboardId);
		if (dashboard) {
			if (has3dWidget(dashboard, 'field')) {
				preloadField3d();
			}
			const loaders = new Set(
				panes(dashboard.layout).map(({ widget }) => widget && getWidgetType(widget.type)?.preload),
			);
			await Promise.all([...loaders].flatMap((load) => (load ? [load()] : [])));
		}
	},
	component: DashboardView,
});

function DashboardView() {
	const { dashboardId } = Route.useParams();
	const dashboards = useDashboards();
	const index = dashboards.findIndex((other) => other.id === dashboardId);
	const dashboard = dashboards[index];
	// Remembered so closing this dashboard can select the one that took its place in the sidebar, or the page it was
	// opened from, since the location changes while navigating there
	const [lastIndex, setLastIndex] = useState(index);
	const currentOpener = useLocation({ select: (location) => location.state.opener });
	const [opener, setOpener] = useState(currentOpener);
	// While a pane is moved, other panes are only drop targets. Without pointer events they can't be hovered, and dnd-kit
	// doesn't auto-scroll them when the pointer nears their edges, since it scrolls the element under the pointer.
	const [movingPane, setMovingPane] = useState(false);
	useDragDropMonitor({
		onDragStart: ({ operation }) => setMovingPane(isPaneDrag(operation.source)),
		onDragEnd: () => setMovingPane(false),
	});
	// Others in a shared dashboard see this window in it
	useEffect(() => {
		setViewedDashboard(dashboardId);
		return () => setViewedDashboard(undefined);
	}, [dashboardId]);
	useNamePrompt(dashboard?.shared === true);
	if (index !== -1 && index !== lastIndex) {
		setLastIndex(index);
	}
	if (dashboard && currentOpener !== opener) {
		setOpener(currentOpener);
	}

	if (!dashboard) {
		// Like closing a browser tab before going anywhere else, return to the page it was opened from
		if (opener && (opener.dashboardId === undefined || dashboards.some((other) => other.id === opener.dashboardId))) {
			return <Navigate to={opener.pathname} replace />;
		}

		// Like closing a browser tab, select the next dashboard, or the previous one if this was the last
		const neighbor = lastIndex === -1 ? undefined : dashboards[Math.min(lastIndex, dashboards.length - 1)];
		if (neighbor) {
			return <Navigate to="/dashboards/$dashboardId" params={{ dashboardId: neighbor.id }} replace />;
		}

		return <Navigate to="/" replace />;
	}

	return (
		<div {...stylex.props(styles.fill, movingPane && styles.movingPane)}>
			<Group orientation="horizontal" {...stylex.props(styles.fill)}>
				{/* Widening the entry browser stops at the panes' minimum size on desktop, where the window is kept big enough for
				    it. A smaller browser window shrinks the panes before the entry browser. */}
				<Panel minSize={STUDIO_DESKTOP ? minNodeSize(dashboard.layout, 'row') : '7rem'} style={{ overflow: 'hidden' }}>
					<PanesColumn dashboard={dashboard} dashboards={dashboards} />
				</Panel>
				<EntryBrowser dashboard={dashboard} />
			</Group>
		</div>
	);
}

function PanesColumn({ dashboard, dashboards }: { dashboard: Dashboard; dashboards: readonly Dashboard[] }) {
	const exporting = useVideoExport()?.dashboardId === dashboard.id;
	const mobile = useMobileLayout();
	const [recent, setRecent] = useState({ active: dashboard.id, parked: undefined as string | undefined });
	if (recent.active !== dashboard.id) {
		const previous = dashboards.find(({ id }) => id === recent.active);
		const parked =
			previous && (has3dWidget(previous, 'field') || has3dWidget(previous, 'robot')) ? previous.id : recent.parked;
		// More than one inactive layout can hold too many WebGL contexts. Keep only the most recent 3D layout.
		setRecent({ active: dashboard.id, parked: parked === dashboard.id ? undefined : parked });
	}
	const parked = dashboards.find(({ id }) => id === recent.parked);
	useHotkey(
		shortcuts.copyDashboardImage,
		(event) => {
			if (!STUDIO_DESKTOP || event.defaultPrevented || window.getSelection()?.isCollapsed === false) {
				return;
			}
			const target = dashboardCaptureTarget(dashboard.id);
			if (target) {
				event.preventDefault();
				void copyImage(target);
			}
		},
		// Run after widgets' document shortcuts, such as copying a field position.
		{
			enabled: canCapture && canCopyDashboardLink(dashboard),
			target: window,
			ignoreInputs: true,
			preventDefault: false,
			stopPropagation: false,
			requireReset: true,
		},
	);

	return (
		<div {...stylex.props(styles.column)}>
			{/* Shown with capture styling in video export mode, so the preview looks like the video */}
			<div
				data-capture-dashboard={dashboard.id}
				data-capturing={exporting ? '' : undefined}
				{...stylex.props(styles.capture, mobile && styles.mobileCapture)}
			>
				<section aria-label="Panes" {...stylex.props(styles.panes)}>
					{(parked ? [dashboard, parked] : [dashboard]).map((item) => (
						<Activity key={item.id} mode={item.id === dashboard.id ? 'visible' : 'hidden'}>
							<DashboardPanes dashboard={item} />
						</Activity>
					))}
					<DashboardSplitZones dashboard={dashboard} />
				</section>
				{exporting && <TimelineBar />}
			</div>
			{exporting && <VideoExportBar />}
		</div>
	);
}
