import { useMatchRoute } from '@tanstack/react-router';
import CloudIcon from 'lucide-react/icons/cloud';
import FolderSyncIcon from 'lucide-react/icons/folder-sync';
import SettingsIcon from 'lucide-react/icons/settings';
import SlidersHorizontalIcon from 'lucide-react/icons/sliders-horizontal';
import { cloudDeploymentUrl } from '@/cloud/deployment';
import { shortcuts } from '@/commands/commands';
import { TooltipLabel } from '@/components/tooltip-label';
import { AppSidebarFooter } from '@/sidebar/app-sidebar-footer';
import { ShortcutHint } from '@/sidebar/shortcut-hint';
import { SidebarDashboards } from '@/sidebar/sidebar-dashboards';
import {
	SidebarContent,
	SidebarGroup,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from '@/sidebar/sidebar-ui';
import { SourceList } from '@/sidebar/source-list';

function noop(): void {}

export function SidebarItems({
	belowTitleBar = false,
	expanded = true,
	closing = false,
	onShow = noop,
}: {
	/** Leaves room for the title bar above the header, see `sidebar-ui.css` */
	belowTitleBar?: boolean;
	expanded?: boolean;
	closing?: boolean;
	onShow?: () => void;
}) {
	const matchRoute = useMatchRoute();
	return (
		<>
			<SidebarHeader data-below-title-bar={belowTitleBar ? '' : undefined}>
				<SourceList onShow={onShow} />
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton
								isActive={Boolean(matchRoute({ to: '/logs' }))}
								href="/logs"
								tooltip={<TooltipLabel label="Logs" shortcut={shortcuts.logs} />}
							>
								<FolderSyncIcon />
								<span>Logs</span>
							</SidebarMenuButton>
							<ShortcutHint shortcut={shortcuts.logs} />
						</SidebarMenuItem>
						<SidebarMenuItem>
							<SidebarMenuButton isActive={Boolean(matchRoute({ to: '/tuning' }))} href="/tuning" tooltip="Tuning">
								<SlidersHorizontalIcon />
								<span>Tuning</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
						{cloudDeploymentUrl !== undefined && (
							<SidebarMenuItem>
								<SidebarMenuButton isActive={Boolean(matchRoute({ to: '/cloud' }))} href="/cloud" tooltip="Cloud">
									<CloudIcon />
									<span>Cloud</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
						)}
						<SidebarMenuItem>
							<SidebarMenuButton
								isActive={Boolean(matchRoute({ to: '/settings' }))}
								href="/settings"
								tooltip={<TooltipLabel label="Settings" shortcut={shortcuts.settings} />}
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
