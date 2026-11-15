import { Outlet, createRootRoute } from '@tanstack/react-router';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarInset } from '@/components/ui/sidebar';
import { ToastProvider } from '@/components/ui/toast';

export const Route = createRootRoute({
	component: RootLayout,
});

function RootLayout() {
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
