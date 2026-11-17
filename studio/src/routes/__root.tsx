import { Outlet, createRootRoute } from '@tanstack/react-router';
import { useGlobalShortcuts } from '@/commands';
import { AppSidebar } from '@/components/app-sidebar';
import { DashboardSplitZones } from '@/components/dashboard-drag';
import { DragProvider } from '@/components/drag-provider';
import { KeyboardShortcutsDialog } from '@/components/keyboard-shortcuts-dialog';
import { LogDropOverlay } from '@/components/log-drop-overlay';
import { SidebarInset } from '@/components/ui/sidebar';
import { ToastProvider } from '@/components/ui/toast';

export const Route = createRootRoute({
	component: RootLayout,
});

function RootLayout() {
	useGlobalShortcuts();

	return (
		<ToastProvider>
			{/* Wraps the whole app, so dashboards and panes can be dragged between the sidebar and the main area */}
			<DragProvider>
				<div className="flex h-svh">
					<AppSidebar />
					<SidebarInset className="relative overflow-hidden">
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
