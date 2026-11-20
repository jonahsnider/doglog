import ChevronDownIcon from 'lucide-react/icons/chevron-down';
import CircleArrowUpIcon from 'lucide-react/icons/circle-arrow-up';
import DownloadIcon from 'lucide-react/icons/download';
import KeyboardIcon from 'lucide-react/icons/keyboard';
import RefreshCwIcon from 'lucide-react/icons/refresh-cw';
import { WhatsNewCard } from '@/changelog/whats-new-card';
import { shortcuts } from '@/commands/commands';
import { KeyboardShortcutsDialog } from '@/commands/keyboard-shortcuts-dialog';
import { TooltipLabel } from '@/components/tooltip-label';
import { DialogTrigger } from '@/components/ui/dialog';
import { SidebarFooter, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { CopyDownloadMenu } from '@/desktop/download-button';
import { checkForUpdateManually, installUpdate, updateTitle, useUpdate } from '@/updater';

// Fade the expanded-only rows without removing their space until the sidebar switches to the rail layout.
const expandedRow =
	'transition-opacity duration-150 ease-in in-data-[animation=collapse]:opacity-0 in-data-[animation=unpeek]:opacity-0 motion-reduce:transition-none';

export function AppSidebarFooter({
	expanded,
	closing,
	onShow,
}: {
	expanded: boolean;
	closing: boolean;
	onShow: () => void;
}) {
	const update = useUpdate();
	const installing = update?.installing ?? false;
	const updateLabel = installing ? 'Updating…' : update ? updateTitle(update.update) : 'Check for updates';
	return (
		<SidebarFooter>
			<WhatsNewCard onShow={onShow} />
			<KeyboardShortcutsDialog>
				{(expanded || update) && (
					<SidebarMenu className="text-muted-foreground">
						{expanded && (
							<>
								<SidebarMenuItem className={expandedRow} inert={closing}>
									<Tooltip>
										<DialogTrigger render={<TooltipTrigger render={<SidebarMenuButton size="sm" />} />}>
											<KeyboardIcon />
											<span>Keyboard shortcuts</span>
										</DialogTrigger>
										<TooltipPopup side="right">
											<TooltipLabel label="Keyboard shortcuts" shortcut={shortcuts.keyboardShortcuts} />
										</TooltipPopup>
									</Tooltip>
								</SidebarMenuItem>
								<SidebarMenuItem className={expandedRow} inert={closing}>
									<CopyDownloadMenu
										trigger={
											<SidebarMenuButton
												size="sm"
												className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
											>
												<DownloadIcon />
												<span>Download app</span>
												<ChevronDownIcon className="ms-auto" />
											</SidebarMenuButton>
										}
									/>
								</SidebarMenuItem>
							</>
						)}
						<SidebarMenuItem className={update ? undefined : expandedRow} inert={closing && !update}>
							<Tooltip>
								<TooltipTrigger
									render={
										<SidebarMenuButton
											size="sm"
											disabled={installing}
											className={update ? 'text-sidebar-foreground' : undefined}
											onClick={() => void (update ? installUpdate(update.update) : checkForUpdateManually())}
										/>
									}
								>
									{installing ? (
										<Spinner aria-hidden />
									) : update ? (
										<CircleArrowUpIcon className="text-sidebar-primary" />
									) : (
										<RefreshCwIcon />
									)}
									<span>{updateLabel}</span>
								</TooltipTrigger>
								<TooltipPopup side="right">
									<TooltipLabel label={updateLabel} shortcut={shortcuts.update} />
								</TooltipPopup>
							</Tooltip>
						</SidebarMenuItem>
					</SidebarMenu>
				)}
			</KeyboardShortcutsDialog>
		</SidebarFooter>
	);
}
