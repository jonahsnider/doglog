import { Link, useMatchRoute } from '@tanstack/react-router';
import { DatabaseIcon, FolderSyncIcon, LayoutDashboardIcon, PlusIcon, SettingsIcon } from 'lucide-react';
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupAction,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
} from '@/components/ui/sidebar';
import { dashboards } from '@/dashboards';

export function AppSidebar() {
	const matchRoute = useMatchRoute();

	return (
		<Sidebar collapsible="none" className="h-svh border-r">
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						{/* Placeholder until log files and NT connections are implemented */}
						<SidebarMenuButton size="lg" disabled>
							<DatabaseIcon />
							<span>No data source</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton isActive={Boolean(matchRoute({ to: '/logs' }))} render={<Link to="/logs" />}>
								<FolderSyncIcon />
								<span>Logs</span>
							</SidebarMenuButton>
							<SidebarMenuBadge>Soon</SidebarMenuBadge>
						</SidebarMenuItem>
						<SidebarMenuItem>
							<SidebarMenuButton isActive={Boolean(matchRoute({ to: '/settings' }))} render={<Link to="/settings" />}>
								<SettingsIcon />
								<span>Settings</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarGroup>
				<SidebarGroup>
					<SidebarGroupLabel>Dashboards</SidebarGroupLabel>
					{/* Placeholder until dashboards can be created */}
					<SidebarGroupAction title="New dashboard" disabled>
						<PlusIcon />
						<span className="sr-only">New dashboard</span>
					</SidebarGroupAction>
					<SidebarMenu>
						{dashboards.map((dashboard) => (
							<SidebarMenuItem key={dashboard.id}>
								<SidebarMenuButton
									isActive={Boolean(
										matchRoute({ to: '/dashboards/$dashboardId', params: { dashboardId: dashboard.id } }),
									)}
									render={<Link to="/dashboards/$dashboardId" params={{ dashboardId: dashboard.id }} />}
								>
									<LayoutDashboardIcon />
									<span>{dashboard.name}</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
						))}
					</SidebarMenu>
				</SidebarGroup>
			</SidebarContent>
		</Sidebar>
	);
}
