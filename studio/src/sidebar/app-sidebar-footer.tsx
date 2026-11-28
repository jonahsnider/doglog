import { Spinner } from '@astryxdesign/core/Spinner';
import { Tooltip } from '@astryxdesign/core/Tooltip';
import ChevronDownIcon from 'lucide-react/icons/chevron-down';
import CircleArrowUpIcon from 'lucide-react/icons/circle-arrow-up';
import DownloadIcon from 'lucide-react/icons/download';
import KeyboardIcon from 'lucide-react/icons/keyboard';
import RefreshCwIcon from 'lucide-react/icons/refresh-cw';
import SearchIcon from 'lucide-react/icons/search';
import { WhatsNewCard } from '@/changelog/whats-new-card';
import { shortcuts } from '@/commands/commands';
import { commandPaletteOpen } from '@/commands/command-palette-handle';
import { keyboardShortcutsDialogOpen } from '@/commands/keyboard-shortcuts-dialog-handle';
import { TextMorph } from '@/components/text-morph';
import { TooltipLabel } from '@/components/tooltip-label';
import { DownloadMenu } from '@/desktop/download-button';
import { useMediaQuery } from '@/hooks/use-media-query';
import { isMobileDevice } from '@/lib/mobile-layout';
import { useSidebar } from '@/sidebar/sidebar-context';
import { SidebarFooter, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/sidebar/sidebar-ui';
import { checkForUpdateManually, installUpdate, updateTitle, useUpdate } from '@/updater';

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
	const { isMobile } = useSidebar();
	const update = useUpdate();
	const installing = update?.installing ?? false;
	const updateLabel = installing ? 'Updating…' : update ? updateTitle(update.update) : 'Check for updates';
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
					<SidebarMenuItem {...(update ? {} : expandedRow)} inert={closing && !update}>
						<Tooltip content={<TooltipLabel label={updateLabel} shortcut={shortcuts.update} />} placement="end">
							<SidebarMenuButton
								size="sm"
								disabled={installing}
								data-update-ready={update ? '' : undefined}
								onClick={() => void (update ? installUpdate(update.update) : checkForUpdateManually())}
							>
								{installing ? (
									<Spinner size="sm" aria-label="Updating" />
								) : update ? (
									<CircleArrowUpIcon color="var(--color-icon-accent)" />
								) : (
									<RefreshCwIcon />
								)}
								<TextMorph numbers={false}>{updateLabel}</TextMorph>
							</SidebarMenuButton>
						</Tooltip>
					</SidebarMenuItem>
				</SidebarMenu>
			)}
		</SidebarFooter>
	);
}

function SidebarDownload({ closing }: { closing: boolean }) {
	const standalone = useMediaQuery('(display-mode: standalone)');
	if (standalone || isMobileDevice()) {
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
