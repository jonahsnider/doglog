import { type Hotkey, useFormatForDisplay, useHotkey } from '@tanstack/react-hotkeys';
import { Link, useMatchRoute } from '@tanstack/react-router';
import { useSelector } from '@tanstack/react-store';
import { CircleArrowUpIcon, FolderSyncIcon, SettingsIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
	Sidebar,
	SidebarContent,
	SidebarContext,
	type SidebarContextProps,
	SidebarFooter,
	SidebarGroup,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
} from '@/components/ui/sidebar';
import { SourceControl } from '@/sidebar/source-control';
import { SidebarDashboards } from '@/sidebar/sidebar-dashboards';
import { TooltipLabel } from '@/components/tooltip-label';
import { Kbd } from '@/components/ui/kbd';
import { Spinner } from '@/components/ui/spinner';
import { shortcuts, useShortcutHint } from '@/commands/commands';
import { cn } from '@/lib/utils';
import { sidebarCollapsedStore } from '@/sidebar/sidebar';
import { TitleBar } from '@/sidebar/title-bar';
import { installUpdate, useUpdate } from '@/desktop/updater';
import { useWindowColor } from '@/theme/window-color';
import { WhatsNewCard } from '@/changelog/whats-new-card';

/** How long the pointer has to stay on or away from the collapsed sidebar before it's shown or hidden */
const peekDelay = 300;
/** Keeps the peeking sidebar open while the pointer is elsewhere: an open menu, renaming a dashboard, or dragging one */
const keepPeekingSelector =
	'[data-slot="menu-trigger"][data-popup-open], [data-slot="context-menu-trigger"][data-popup-open], input:focus, [data-dnd-dragging]';

function noop(): void {}

/** Shows `shortcut` like the dashboards' shortcuts while its modifier is held */
function ShortcutHint({ shortcut }: { shortcut: Hotkey }) {
	const formatForDisplay = useFormatForDisplay();
	return (
		useShortcutHint(shortcut) && (
			<SidebarMenuBadge>
				<Kbd>{formatForDisplay(shortcut)}</Kbd>
			</SidebarMenuBadge>
		)
	);
}

export function AppSidebar() {
	const matchRoute = useMatchRoute();
	const collapsed = useSelector(sidebarCollapsedStore);
	const windowColor = useWindowColor();
	const update = useUpdate();
	// Showing the collapsed sidebar over the dashboard while it's hovered
	const [peeking, setPeeking] = useState(false);
	// Toggling with the keyboard skips the animation, clicking and peeking keep it
	const [animated, setAnimated] = useState(true);
	const showTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
	const sidebarRef = useRef<HTMLDivElement>(null);
	// Holds the sidebar and its title bar
	const containerRef = useRef<HTMLDivElement>(null);
	const iconOnly = collapsed && !peeking;

	const toggle = (animate: boolean) => {
		clearTimeout(showTimer.current);
		setPeeking(false);
		setAnimated(animate);
		sidebarCollapsedStore.set((value) => !value);
	};

	const peek = () => {
		clearTimeout(showTimer.current);
		setAnimated(true);
		setPeeking(true);
	};
	useHotkey(shortcuts.toggleSidebar, () => toggle(false), { requireReset: true });

	// Hide the peeking sidebar once the pointer leaves it, checked on pointer moves since menus are rendered outside of it
	// react-doctor-disable-next-line react-doctor/effect-needs-cleanup -- The cleanup clears `hide.timer`
	useEffect(() => {
		if (!peeking) {
			return undefined;
		}

		const hide: { timer: ReturnType<typeof setTimeout> | undefined } = { timer: undefined };
		const onPointerMove = (event: PointerEvent) => {
			const container = containerRef.current;
			if (!container || (event.target instanceof Node && container.contains(event.target))) {
				clearTimeout(hide.timer);
				hide.timer = undefined;
				return;
			}

			hide.timer ??= setTimeout(() => {
				hide.timer = undefined;
				if (!container.querySelector(keepPeekingSelector)) {
					setPeeking(false);
				}
			}, peekDelay);
		};

		document.addEventListener('pointermove', onPointerMove);
		return () => {
			document.removeEventListener('pointermove', onPointerMove);
			clearTimeout(hide.timer);
		};
	}, [peeking]);

	// Provided directly instead of using `SidebarProvider`, its open state is saved with `cookieStore`, which WebKit lacks
	const context: SidebarContextProps = {
		state: iconOnly ? 'collapsed' : 'expanded',
		open: !collapsed,
		setOpen: (open) => sidebarCollapsedStore.set(!open),
		openMobile: false,
		setOpenMobile: noop,
		isMobile: false,
		toggleSidebar: () => toggle(true),
	};

	return (
		<SidebarContext value={context}>
			{/* Reserves the sidebar's space in the layout, so peeking doesn't resize the dashboard */}
			<div
				ref={containerRef}
				className={cn(
					'relative shrink-0 [--sidebar-width-icon:3rem] [--sidebar-width:17rem]',
					collapsed ? 'w-(--sidebar-width-icon)' : 'w-(--sidebar-width)',
				)}
			>
				<TitleBar collapsed={collapsed} iconOnly={iconOnly} onToggle={() => toggle(true)} />
				<Sidebar
					ref={sidebarRef}
					collapsible="none"
					data-collapsible={iconOnly ? 'icon' : undefined}
					className={cn(
						'group absolute inset-y-0 start-0 z-20 overflow-hidden transition-[width,box-shadow] duration-200 motion-reduce:transition-none',
						// A line instead of a border, so the title bar can cover it under the traffic lights
						'after:pointer-events-none after:absolute after:inset-y-0 after:end-0 after:w-px after:bg-border',
						iconOnly && 'w-(--sidebar-width-icon)',
						collapsed && peeking && 'shadow-lg',
						// The content is already at its final size, see below
						'[&_[data-sidebar=menu-button]]:transition-none',
						!animated && 'transition-none',
					)}
					onPointerEnter={(event) => {
						if (collapsed && !peeking && event.pointerType !== 'touch') {
							showTimer.current = setTimeout(peek, peekDelay);
						}
					}}
					onPointerLeave={() => clearTimeout(showTimer.current)}
				>
					{/* Like sliding panes, the content keeps the width it ends at and is clipped, so it isn't laid out again every frame while the sidebar's width animates */}
					<div className="flex h-full w-(--sidebar-width) shrink-0 flex-col contain-strict group-data-[collapsible=icon]:w-(--sidebar-width-icon)">
						<SidebarHeader
							// Leaves room for the title bar
							className="pt-9"
							// Tints the top of the sidebar, see `index.css`
							data-window-color={windowColor}
						>
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
						<SidebarFooter>
							<WhatsNewCard onShow={peek} />
							{update && (
								<SidebarMenu>
									<SidebarMenuItem>
										<SidebarMenuButton
											disabled={update.installing}
											onClick={() => void installUpdate(update.update)}
											tooltip={`Update to ${update.update.version}`}
										>
											{update.installing ? <Spinner /> : <CircleArrowUpIcon className="text-sidebar-primary" />}
											<span>{update.installing ? 'Updating…' : `Update to ${update.update.version}`}</span>
										</SidebarMenuButton>
									</SidebarMenuItem>
								</SidebarMenu>
							)}
						</SidebarFooter>
					</div>
				</Sidebar>
			</div>
		</SidebarContext>
	);
}
