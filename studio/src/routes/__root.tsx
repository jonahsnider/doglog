import { Outlet, createRootRoute, useMatchRoute } from '@tanstack/react-router';
import { useGlobalShortcuts } from '@/commands/commands';
import { AppSidebar } from '@/sidebar/app-sidebar';
import { DashboardSplitZones } from '@/dashboards/dashboard-drag';
import { DragProvider } from '@/components/drag-provider';
import { KeyboardShortcutsDialog } from '@/commands/keyboard-shortcuts-dialog';
import { LogDropOverlay } from '@/components/log-drop-overlay';
import { SidebarInset } from '@/components/ui/sidebar';
import { ToastProvider } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { useTitleBarStrip } from '@/desktop/title-bar';

export const Route = createRootRoute({
	component: RootLayout,
});

function RootLayout() {
	useGlobalShortcuts();
	const matchRoute = useMatchRoute();
	// Dashboards lay out their own panes, entry browser, and timeline on the frame, other pages are one container
	const dashboard = Boolean(matchRoute({ to: '/dashboards/$dashboardId' }));
	const strip = useTitleBarStrip();

	return (
		<ToastProvider>
			{/* Wraps the whole app, so dashboards and panes can be dragged between the sidebar and the main area */}
			<DragProvider>
				<div className="group/app flex h-svh bg-frame">
					<AppSidebar />
					<SidebarInset
						className={cn(
							'relative overflow-hidden',
							dashboard ? 'bg-transparent' : 'm-1.5 rounded-lg',
							// Below the title bar's strip and a gap like the one pages have around them, lined up with the rail
							strip && 'mt-10.5',
						)}
					>
						<Outlet />
						<DashboardSplitZones />
					</SidebarInset>
				</div>
			</DragProvider>
			<LogDropOverlay />
			<KeyboardShortcutsDialog />
		</ToastProvider>
	);
}
