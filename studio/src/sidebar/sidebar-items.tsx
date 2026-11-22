import { Link, useMatchRoute } from '@tanstack/react-router';
import FolderSyncIcon from 'lucide-react/icons/folder-sync';
import SettingsIcon from 'lucide-react/icons/settings';
import SlidersHorizontalIcon from 'lucide-react/icons/sliders-horizontal';
import { shortcuts } from '@/commands/commands';
import { TooltipLabel } from '@/components/tooltip-label';
import {
	SidebarContent,
	SidebarGroup,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from '@/components/ui/sidebar';
import { AppSidebarFooter } from '@/sidebar/app-sidebar-footer';
import { ShortcutHint } from '@/sidebar/shortcut-hint';
import { SidebarDashboards } from '@/sidebar/sidebar-dashboards';
import { SourceControl } from '@/sidebar/source-control';

function noop(): void {}

export function SidebarItems({
	headerClassName,
	expanded = true,
	closing = false,
	onShow = noop,
}: {
	headerClassName?: string;
	expanded?: boolean;
	closing?: boolean;
	onShow?: () => void;
}) {
	const matchRoute = useMatchRoute();
	return (
		<>
			<SidebarHeader className={headerClassName}>
				<SidebarMenu>
					<SourceControl />
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton
								isActive={Boolean(matchRoute({ to: '/logs' }))}
								render={<Link to="/logs" />}
								tooltip={{ children: <TooltipLabel label="Logs" shortcut={shortcuts.logs} /> }}
							>
								<FolderSyncIcon />
								<span>Logs</span>
							</SidebarMenuButton>
							<ShortcutHint shortcut={shortcuts.logs} />
						</SidebarMenuItem>
						<SidebarMenuItem>
							<SidebarMenuButton
								isActive={Boolean(matchRoute({ to: '/tuning' }))}
								render={<Link to="/tuning" />}
								tooltip={{ children: 'Tuning' }}
							>
								<SlidersHorizontalIcon />
								<span>Tuning</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
						<SidebarMenuItem>
							<SidebarMenuButton
								isActive={Boolean(matchRoute({ to: '/settings' }))}
								render={<Link to="/settings" />}
								tooltip={{ children: <TooltipLabel label="Settings" shortcut={shortcuts.settings} /> }}
							>
								<SettingsIcon />
								<span>Settings</span>
							</SidebarMenuButton>
							<ShortcutHint shortcut={shortcuts.settings} />
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarGroup>
				<SidebarDashboards />
			</SidebarContent>
			<AppSidebarFooter expanded={expanded} closing={closing} onShow={onShow} />
		</>
	);
}
