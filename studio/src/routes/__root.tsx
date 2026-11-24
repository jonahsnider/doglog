import { Outlet, createRootRoute, useMatchRoute } from '@tanstack/react-router';
import { useSelector } from '@tanstack/react-store';
import { useGlobalShortcuts } from '@/commands/commands';
import { AppSidebar } from '@/sidebar/app-sidebar';
import { useVideoExport } from '@/desktop/video-export';
import { CloudProvider } from '@/cloud/cloud-background';
import { AboutDialog } from '@/components/about-dialog';
import { DragProvider } from '@/components/drag-provider';
import { OpenLogUrlDialog } from '@/components/open-log-url-dialog';
import { useDesktopLinkOffer } from '@/dashboards/open-dashboard-link';
import { LogDropOverlay } from '@/components/log-drop-overlay';
import { SidebarInset } from '@/components/ui/sidebar';
import { Toasts } from '@/components/toasts';
import { useMobileLayout } from '@/lib/mobile-layout';
import { cn } from '@/lib/utils';
import { useTitleBarStrip } from '@/desktop/title-bar';
import { sidebarAnimationStore } from '@/sidebar/sidebar';
import { TimelineBar } from '@/timeline/timeline-bar';
import { useWindowTitle } from '@/window-title';

export const Route = createRootRoute({
	component: RootLayout,
});

function RootLayout() {
	useGlobalShortcuts();
	useWindowTitle();
	// After the toast bridge's effect subscribes it, since child effects run first
	useDesktopLinkOffer();
	const matchRoute = useMatchRoute();
	const dashboard = matchRoute({ to: '/dashboards/$dashboardId' }) !== false;
	// Dashboards and Tuning lay out their own panes and entry browser on the frame, other pages are one container
	const panes = dashboard || matchRoute({ to: '/tuning' }) !== false;
	const strip = useTitleBarStrip();
	const animation = useSelector(sidebarAnimationStore);
	const exporting = useVideoExport() !== undefined;
	const mobile = useMobileLayout();

	return (
		<CloudProvider>
			<Toasts>
				{/* Wraps the whole app, so dashboards and panes can be dragged between the sidebar and the main area */}
				<DragProvider>
					<div
						className={cn(
							'group/app flex flex-col bg-frame [--sidebar-width-icon:2.625rem] [--sidebar-width:17.25rem]',
							// Give iOS an opaque top edge to extend into the status bar instead of blurring over the app.
							!STUDIO_DESKTOP &&
								'[@media(display-mode:standalone)]:supports-[-webkit-touch-callout:none]:sticky [@media(display-mode:standalone)]:supports-[-webkit-touch-callout:none]:top-0',
							mobile ? 'h-dvh' : 'h-svh',
						)}
					>
						<div className={cn('flex min-h-0 flex-1', mobile && 'flex-col')}>
							<div inert={exporting} className="contents">
								<AppSidebar mobile={mobile} />
							</div>
							<SidebarInset
								className={cn(
									'relative overflow-hidden',
									panes ? 'bg-transparent' : 'm-1.5 rounded-lg',
									mobile && (panes ? 'min-h-0 pe-1.5' : 'min-h-0 w-auto'),
									// Below the title bar's strip, lined up with the rail. Pages have a gap around them, dashboards have it inside.
									strip && (panes ? 'mt-9' : 'mt-10.5'),
									// Moves below the strip before the sidebar collapses, and back up after it expands
									animation && 'transition-[margin] duration-150 motion-reduce:transition-none',
								)}
							>
								<Outlet />
							</SidebarInset>
						</div>
						{dashboard && !exporting && <TimelineBar />}
					</div>
				</DragProvider>
				<LogDropOverlay />
				<AboutDialog />
				<OpenLogUrlDialog />
			</Toasts>
		</CloudProvider>
	);
}
