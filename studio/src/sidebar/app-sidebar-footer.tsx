import ChevronDownIcon from 'lucide-react/icons/chevron-down';
import CircleArrowUpIcon from 'lucide-react/icons/circle-arrow-up';
import DownloadIcon from 'lucide-react/icons/download';
import KeyboardIcon from 'lucide-react/icons/keyboard';
import RefreshCwIcon from 'lucide-react/icons/refresh-cw';
import { WhatsNewCard } from '@/changelog/whats-new-card';
import { shortcuts } from '@/commands/commands';
import { keyboardShortcutsDialogOpen } from '@/commands/keyboard-shortcuts-dialog-handle';
import { TextMorph } from '@/components/text-morph';
import { TooltipLabel } from '@/components/tooltip-label';
import { SidebarFooter, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { DownloadMenu } from '@/desktop/download-button';
import { cn } from '@/lib/utils';
import { checkForUpdateManually, installUpdate, updateTitle, useUpdate } from '@/updater';

const expandedRow = cn(
	'transition-opacity duration-150 ease-in motion-reduce:transition-none',
	// Hidden until the sidebar is hovered or in use, keeping their space so the dashboards don't move. Always shown without hover.
	'[@media(hover:hover)]:opacity-0 group-hover:opacity-100 group-has-focus-visible:opacity-100 group-has-data-popup-open:opacity-100',
	// Keep the card and actions together instead of leaving the card above invisible rows.
	'group-has-[[data-slot=whats-new-card]]:opacity-100',
	// Fade without removing their space until the sidebar switches to the rail layout
	'in-data-[animation=collapse]:opacity-0!',
);

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
			{(expanded || update) && (
				<SidebarMenu className="text-muted-foreground">
					{expanded && (
						<>
							<SidebarMenuItem className={expandedRow} inert={closing}>
								<Tooltip>
									<TooltipTrigger
										render={<SidebarMenuButton size="sm" onClick={() => keyboardShortcutsDialogOpen.set(true)} />}
									>
										<KeyboardIcon />
										<span>Keyboard shortcuts</span>
									</TooltipTrigger>
									<TooltipPopup side="right">
										<TooltipLabel label="Keyboard shortcuts" shortcut={shortcuts.keyboardShortcuts} />
									</TooltipPopup>
								</Tooltip>
							</SidebarMenuItem>
							<SidebarMenuItem className={expandedRow} inert={closing}>
								<DownloadMenu
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
										className={cn(
											// The rail's 32px square overhangs the row's 28px, so its icon stays put when the sidebar peeks
											'group-data-[collapsible=icon]:-my-0.5',
											update && 'text-sidebar-foreground',
										)}
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
								<TextMorph numbers={false}>{updateLabel}</TextMorph>
							</TooltipTrigger>
							<TooltipPopup side="right">
								<TooltipLabel label={updateLabel} shortcut={shortcuts.update} />
							</TooltipPopup>
						</Tooltip>
					</SidebarMenuItem>
				</SidebarMenu>
			)}
		</SidebarFooter>
	);
}
