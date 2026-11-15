import { Link, useMatchRoute } from '@tanstack/react-router';
import { FolderSyncIcon, SettingsIcon } from 'lucide-react';
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
} from '@/components/ui/sidebar';
import { SourceControl } from '@/components/source-control';
import { SidebarDashboards } from '@/components/sidebar-dashboards';

export function AppSidebar() {
	const matchRoute = useMatchRoute();

	return (
		<Sidebar collapsible="none" className="h-svh border-r">
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SourceControl />
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
				<SidebarDashboards />
			</SidebarContent>
		</Sidebar>
	);
}
