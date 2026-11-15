import { Outlet, createRootRoute } from '@tanstack/react-router';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { ToastProvider } from '@/components/ui/toast';

export const Route = createRootRoute({
	component: RootLayout,
});

function keepOpen(): void {}

function RootLayout() {
	return (
		<ToastProvider>
			{/* The sidebar can't collapse, keeping it open makes the built-in Mod+B toggle do nothing */}
			<SidebarProvider open onOpenChange={keepOpen}>
				<AppSidebar />
				<SidebarInset className="h-svh overflow-hidden">
					<Outlet />
				</SidebarInset>
			</SidebarProvider>
		</ToastProvider>
	);
}
