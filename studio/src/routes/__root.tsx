import { Outlet, createRootRoute } from '@tanstack/react-router';
import { useGlobalShortcuts } from '@/commands';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarInset } from '@/components/ui/sidebar';
import { ToastProvider } from '@/components/ui/toast';

export const Route = createRootRoute({
	component: RootLayout,
});

function RootLayout() {
	useGlobalShortcuts();

	return (
		<ToastProvider>
			<div className="flex h-svh">
				<AppSidebar />
				<SidebarInset className="overflow-hidden">
					<Outlet />
				</SidebarInset>
			</div>
		</ToastProvider>
	);
}
