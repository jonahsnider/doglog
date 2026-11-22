import { Outlet, createRootRoute, useMatchRoute } from '@tanstack/react-router';
import { useSelector } from '@tanstack/react-store';
import { useGlobalShortcuts } from '@/commands/commands';
import { AppSidebar } from '@/sidebar/app-sidebar';
import { useVideoExport } from '@/desktop/video-export';
import { AboutDialog } from '@/components/about-dialog';
import { DragProvider } from '@/components/drag-provider';
import { useDesktopLinkOffer } from '@/dashboards/open-dashboard-link';
import { LogDropOverlay } from '@/components/log-drop-overlay';
import { SidebarInset } from '@/components/ui/sidebar';
import { ToastProvider } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { useTitleBarStrip } from '@/desktop/title-bar';
import { sidebarAnimationStore } from '@/sidebar/sidebar';
import { useWindowTitle } from '@/window-title';

export const Route = createRootRoute({
	component: RootLayout,
});

function RootLayout() {
	useGlobalShortcuts();
	useWindowTitle();
	// After ToastProvider's effect subscribes it, since child effects run first
	useDesktopLinkOffer();
	const matchRoute = useMatchRoute();
	// Dashboards and Tuning lay out their own panes and entry browser on the frame, other pages are one container
	const dashboard = matchRoute({ to: '/dashboards/$dashboardId' }) !== false || matchRoute({ to: '/tuning' }) !== false;
	const strip = useTitleBarStrip();
	const animation = useSelector(sidebarAnimationStore);
	const exporting = useVideoExport() !== undefined;

	return (
		<ToastProvider>
			{/* Wraps the whole app, so dashboards and panes can be dragged between the sidebar and the main area */}
			<DragProvider>
				<div className="group/app flex h-svh bg-frame [--sidebar-width-icon:2.625rem] [--sidebar-width:17.25rem]">
					{/* Video export mode keeps the dashboard it previews open, the sidebar stays in place without taking up space of its own */}
					<div inert={exporting} className="contents">
						<AppSidebar />
					</div>
					<SidebarInset
						className={cn(
							'relative overflow-hidden',
							dashboard ? 'bg-transparent' : 'm-1.5 rounded-lg',
							// Below the title bar's strip, lined up with the rail. Pages have a gap around them, dashboards have it inside.
							strip && (dashboard ? 'mt-9' : 'mt-10.5'),
							// Moves below the strip before the sidebar collapses, and back up after it expands
							animation && 'transition-[margin] duration-150 motion-reduce:transition-none',
						)}
					>
						<Outlet />
					</SidebarInset>
				</div>
			</DragProvider>
			<LogDropOverlay />
			<AboutDialog />
		</ToastProvider>
	);
}
