import { useDragDropMonitor } from '@dnd-kit/react';
import { useHotkey } from '@tanstack/react-hotkeys';
import { Navigate, createFileRoute, useLocation, useRouter } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Group, Panel } from 'react-resizable-panels';
import { shortcuts } from '@/commands/commands';
import { canCopyDashboardLink } from '@/dashboards/copy-dashboard-link';
import { DashboardSplitZones } from '@/dashboards/dashboard-drag';
import { DashboardPanes } from '@/dashboards/dashboard-panes';
import { canCapture, copyImage, dashboardCaptureTarget } from '@/desktop/capture';
import { canExportVideo, startVideoExport, useVideoExport } from '@/desktop/video-export';
import { getSource } from '@/data/source';
import { VideoExportBar } from '@/timeline/video-export-bar';
import { EntryBrowser } from '@/entries/entry-browser';
import { TimelineBar } from '@/timeline/timeline-bar';
import { type Dashboard, getDashboard, useDashboards } from '@/dashboards/dashboards';
import { cn } from '@/lib/utils';
import { isPaneDrag } from '@/panes/drag';
import { panes } from '@/panes/layout';
import { minNodeSize } from '@/panes/pane-size';
import { setViewedDashboard } from '@/sharing/presence';
import { useNamePrompt } from '@/sharing/name-prompt';
import { getWidgetType } from '@/widgets/registry';

declare module '@tanstack/react-router' {
	interface HistoryState {
		/** The page a new dashboard was opened from, which closing it returns to */
		opener?: { pathname: string; dashboardId?: string };
	}
}

export const Route = createFileRoute('/dashboards/$dashboardId')({
	loader: async ({ params }) => {
		const dashboard = getDashboard(params.dashboardId);
		if (dashboard) {
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
		<div className={cn('h-full', movingPane && 'pointer-events-none')}>
			<Group orientation="horizontal" className="h-full">
				{/* Widening the entry browser stops at the panes' minimum size on desktop, where the window is kept big enough for
				    it. A smaller browser window shrinks the panes before the entry browser. */}
				<Panel minSize={STUDIO_DESKTOP ? minNodeSize(dashboard.layout, 'row') : '7rem'} style={{ overflow: 'hidden' }}>
					<PanesColumn dashboard={dashboard} />
				</Panel>
				<EntryBrowser dashboard={dashboard} />
			</Group>
		</div>
	);
}

/** The panes with the timeline under them */
function PanesColumn({ dashboard }: { dashboard: Dashboard }) {
	const router = useRouter();
	const exporting = useVideoExport()?.dashboardId === dashboard.id;
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

	// Also stops ⌘R from reloading the window on desktop
	useHotkey(
		shortcuts.exportVideo,
		() => {
			if (canExportVideo(dashboard, getSource())) {
				startVideoExport(router, dashboard.id);
			}
		},
		{ enabled: STUDIO_DESKTOP && canCapture, requireReset: true },
	);

	return (
		// Under the panes rather than the entry browser too, so the entry browser reaches the bottom of the window like the sidebar
		<div className="flex h-full flex-col">
			{/* Shown with capture styling in video export mode, so the preview looks like the video */}
			<div
				data-capture-dashboard={dashboard.id}
				data-capturing={exporting ? '' : undefined}
				className="flex min-h-0 flex-1 flex-col ps-1.5 pt-1.5 capture:bg-frame"
			>
				<section aria-label="Panes" className="relative isolate mb-1.5 min-h-0 min-w-0 flex-1">
					<DashboardPanes dashboard={dashboard} />
					<DashboardSplitZones dashboard={dashboard} />
				</section>
				<TimelineBar />
			</div>
			{exporting && <VideoExportBar />}
		</div>
	);
}
