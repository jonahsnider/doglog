import { Spinner } from '@astryxdesign/core/Spinner';
import { Tooltip } from '@astryxdesign/core/Tooltip';
import { useMatchRoute } from '@tanstack/react-router';
import ChevronDownIcon from 'lucide-react/icons/chevron-down';
import CircleArrowUpIcon from 'lucide-react/icons/circle-arrow-up';
import DownloadIcon from 'lucide-react/icons/download';
import KeyboardIcon from 'lucide-react/icons/keyboard';
import SearchIcon from 'lucide-react/icons/search';
import SettingsIcon from 'lucide-react/icons/settings';
import { WhatsNewCard } from '@/changelog/whats-new-card';
import { shortcuts } from '@/commands/commands';
import { commandPaletteOpen } from '@/commands/command-palette-handle';
import { keyboardShortcutsDialogOpen } from '@/commands/keyboard-shortcuts-dialog-handle';
import { TextMorph } from '@/components/text-morph';
import { TooltipLabel } from '@/components/tooltip-label';
import { DownloadMenu } from '@/desktop/download-button';
import { isMobileDevice } from '@/lib/mobile-layout';
import { useInstalledWebApp } from '@/lib/web-install';
import { ShortcutHint } from '@/sidebar/shortcut-hint';
import { useSidebar } from '@/sidebar/sidebar-context';
import { SidebarInstall } from '@/sidebar/sidebar-install';
import { SidebarFooter, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/sidebar/sidebar-ui';
import { installUpdate, updateTitle, useUpdate } from '@/updater';

/**
 * Rows only shown while the sidebar is expanded. On devices with hover they're hidden until the sidebar is hovered or
 * in use, keeping their space so the dashboards don't move, see `sidebar-ui.css`.
 */
const expandedRow = { 'data-expanded-row': '' };

export function AppSidebarFooter({
	expanded,
	closing,
	onShow,
}: {
	expanded: boolean;
	closing: boolean;
	onShow: () => void;
}) {
	const matchRoute = useMatchRoute();
	const { isMobile } = useSidebar();
	const update = useUpdate();
	const updateLabel = update && (update.installing ? 'Updating…' : updateTitle(update.update));
	return (
		<SidebarFooter>
			<WhatsNewCard onShow={onShow} />
			{(expanded || update) && (
				<SidebarMenu data-footer-actions="">
					{expanded && (
						<SidebarMenuItem {...expandedRow} inert={closing}>
							<Tooltip
								content={<TooltipLabel label="Command palette" shortcut={shortcuts.commandPalette} />}
								placement="end"
							>
								<SidebarMenuButton size="sm" onClick={() => commandPaletteOpen.set(true)}>
									<SearchIcon />
									<span>Command palette</span>
								</SidebarMenuButton>
							</Tooltip>
						</SidebarMenuItem>
					)}
					{expanded && !isMobile && (
						<>
							<SidebarMenuItem {...expandedRow} inert={closing}>
								<Tooltip
									content={<TooltipLabel label="Keyboard shortcuts" shortcut={shortcuts.keyboardShortcuts} />}
									placement="end"
								>
									<SidebarMenuButton size="sm" onClick={() => keyboardShortcutsDialogOpen.set(true)}>
										<KeyboardIcon />
										<span>Keyboard shortcuts</span>
									</SidebarMenuButton>
								</Tooltip>
							</SidebarMenuItem>
							{!STUDIO_DESKTOP && <SidebarDownload closing={closing} />}
						</>
					)}
					{expanded && !STUDIO_DESKTOP && isMobileDevice() && <SidebarInstall closing={closing} />}
					{update && updateLabel !== undefined && (
						<SidebarMenuItem>
							<Tooltip content={<TooltipLabel label={updateLabel} shortcut={shortcuts.update} />} placement="end">
								<SidebarMenuButton
									size="sm"
									disabled={update.installing}
									data-update-ready=""
									onClick={() => void installUpdate(update.update)}
								>
									{update.installing ? (
										<Spinner size="sm" aria-label="Updating" />
									) : (
										<CircleArrowUpIcon color="var(--color-icon-accent)" />
									)}
									<TextMorph numbers={false}>{updateLabel}</TextMorph>
								</SidebarMenuButton>
							</Tooltip>
						</SidebarMenuItem>
					)}
				</SidebarMenu>
			)}
			<SidebarMenu data-settings-menu="">
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
		</SidebarFooter>
	);
}

function SidebarDownload({ closing }: { closing: boolean }) {
	const installed = useInstalledWebApp();
	if (installed || isMobileDevice()) {
		return null;
	}
	return (
		<SidebarMenuItem {...expandedRow} inert={closing}>
			<DownloadMenu
				renderTrigger={(trigger) => (
					<SidebarMenuButton size="sm" {...trigger}>
						<DownloadIcon />
						<span>Download app</span>
						<ChevronDownIcon data-end-icon="" />
					</SidebarMenuButton>
				)}
			/>
		</SidebarMenuItem>
	);
}
