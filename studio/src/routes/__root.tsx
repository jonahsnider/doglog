import { Outlet, createRootRoute } from '@tanstack/react-router';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

export const Route = createRootRoute({
	component: RootLayout,
});

function RootLayout() {
	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset className="h-svh overflow-hidden">
				<Outlet />
			</SidebarInset>
		</SidebarProvider>
	);
}
