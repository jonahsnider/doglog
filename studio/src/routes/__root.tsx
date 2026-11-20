import { Outlet, createRootRoute, useMatchRoute } from '@tanstack/react-router';
import { useSelector } from '@tanstack/react-store';
import { useGlobalShortcuts } from '@/commands/commands';
import { AppSidebar } from '@/sidebar/app-sidebar';
import { DragProvider } from '@/components/drag-provider';
import { useDesktopLinkOffer } from '@/dashboards/open-dashboard-link';
import { LogDropOverlay } from '@/components/log-drop-overlay';
import { SidebarInset } from '@/components/ui/sidebar';
import { ToastProvider } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { useTitleBarStrip } from '@/desktop/title-bar';
import { sidebarAnimationStore } from '@/sidebar/sidebar';

export const Route = createRootRoute({
	component: RootLayout,
});

function RootLayout() {
	useGlobalShortcuts();
	// After ToastProvider's effect subscribes it, since child effects run first
	useDesktopLinkOffer();
	const matchRoute = useMatchRoute();
	// Dashboards lay out their own panes, entry browser, and timeline on the frame, other pages are one container
	const dashboard = Boolean(matchRoute({ to: '/dashboards/$dashboardId' }));
	const strip = useTitleBarStrip();
	const animation = useSelector(sidebarAnimationStore);

	return (
		<ToastProvider>
			{/* Wraps the whole app, so dashboards and panes can be dragged between the sidebar and the main area */}
			<DragProvider>
				<div className="group/app flex h-svh bg-frame [--sidebar-width-icon:3rem] [--sidebar-width:17.25rem]">
					<AppSidebar />
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
		</ToastProvider>
	);
}
