import { type Hotkey, useFormatForDisplay, useHotkey } from '@tanstack/react-hotkeys';
import { Link, useMatchRoute } from '@tanstack/react-router';
import { useSelector } from '@tanstack/react-store';
import { CircleArrowUpIcon, FolderSyncIcon, PanelLeftCloseIcon, PanelLeftOpenIcon, SettingsIcon } from 'lucide-react';
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
	SidebarSeparator,
} from '@/components/ui/sidebar';
import { SourceControl } from '@/sidebar/source-control';
import { SidebarDashboards } from '@/sidebar/sidebar-dashboards';
import { TooltipLabel } from '@/components/tooltip-label';
import { Kbd } from '@/components/ui/kbd';
import { Spinner } from '@/components/ui/spinner';
import { shortcuts, useShortcutHint } from '@/commands/commands';
import { deleteDashboards, useDashboards } from '@/dashboards/dashboards';
import { cn } from '@/lib/utils';
import { sidebarCollapsedStore } from '@/sidebar/sidebar';
import { dragRegion, useTrafficLights } from '@/desktop/title-bar';
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

/** Takes the title bar's place on macOS, the traffic lights are drawn over its start */
function TitleBar() {
	return (
		useTrafficLights() && (
			<div
				{...dragRegion}
				data-slot="title-bar"
				// The traffic lights are wider than the rail, so it matches the top left pane's header to make one bar under them
				className="-mx-2 -mt-2 -mb-2 flex h-9 shrink-0 items-center ps-21 font-heading text-sm font-semibold select-none group-data-[collapsible=icon]:border-b group-data-[collapsible=icon]:bg-background"
			>
				<span className="truncate group-data-[collapsible=icon]:hidden">DogLog Studio</span>
			</div>
		)
	);
}

export function AppSidebar() {
	const matchRoute = useMatchRoute();
	const formatForDisplay = useFormatForDisplay();
	const collapsed = useSelector(sidebarCollapsedStore);
	const dashboards = useDashboards();
	const windowColor = useWindowColor();
	const update = useUpdate();
	// Showing the collapsed sidebar over the dashboard while it's hovered
	const [peeking, setPeeking] = useState(false);
	// Toggling with the keyboard skips the animation, clicking and peeking keep it
	const [animated, setAnimated] = useState(true);
	const showTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
	const sidebarRef = useRef<HTMLDivElement>(null);
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
			const sidebar = sidebarRef.current;
			if (!sidebar || (event.target instanceof Node && sidebar.contains(event.target))) {
				clearTimeout(hide.timer);
				hide.timer = undefined;
				return;
			}

			hide.timer ??= setTimeout(() => {
				hide.timer = undefined;
				if (!sidebar.querySelector(keepPeekingSelector)) {
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
				className={cn(
					'relative shrink-0 [--sidebar-width-icon:3rem] [--sidebar-width:16rem]',
					collapsed ? 'w-(--sidebar-width-icon)' : 'w-(--sidebar-width)',
				)}
			>
				<Sidebar
					ref={sidebarRef}
					collapsible="none"
					data-collapsible={iconOnly ? 'icon' : undefined}
					className={cn(
						'group absolute inset-y-0 start-0 z-20 overflow-hidden transition-[width,box-shadow] duration-200 motion-reduce:transition-none',
						// A line instead of a border, so it can stop short of the traffic lights
						'after:pointer-events-none after:absolute after:inset-y-0 after:end-0 after:w-px after:bg-border',
						'data-[collapsible=icon]:has-data-[slot=title-bar]:after:top-9',
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
							// Tints the top of the sidebar, see `index.css`
							data-window-color={windowColor}
						>
							<TitleBar />
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
							{/* Like Dia, hovering the separator reveals a button to close every dashboard. The negative margin extends the hover area into the surrounding gaps. */}
							<div className="group/separator relative -my-2 py-2">
								<SidebarSeparator />
								{dashboards.length > 0 && (
									<button
										type="button"
										className="absolute end-2 top-1/2 -translate-y-1/2 rounded-md bg-sidebar px-1.5 text-xs whitespace-nowrap text-sidebar-foreground/70 opacity-0 outline-hidden ring-sidebar-ring group-hover/separator:opacity-100 group-data-[collapsible=icon]:hidden hover:text-sidebar-foreground focus-visible:opacity-100 focus-visible:ring-2"
										onClick={() => deleteDashboards(dashboards.map((dashboard) => dashboard.id))}
									>
										Close all
									</button>
								)}
							</div>
							<SidebarDashboards />
						</SidebarContent>
						<SidebarFooter>
							<WhatsNewCard onShow={peek} />
							<SidebarMenu>
								{update && (
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
								)}
								<SidebarMenuItem>
									<SidebarMenuButton
										aria-expanded={!collapsed}
										className="group/toggle"
										onClick={() => toggle(true)}
										tooltip={{ children: <TooltipLabel label="Toggle sidebar" shortcut={shortcuts.toggleSidebar} /> }}
									>
										{collapsed ? <PanelLeftOpenIcon /> : <PanelLeftCloseIcon />}
										{/* Icon-only until hovered, the text is kept for its accessible name */}
										<span className="opacity-0 group-hover/toggle:opacity-100 group-focus-visible/toggle:opacity-100">
											Toggle sidebar
										</span>
									</SidebarMenuButton>
									<SidebarMenuBadge className="invisible peer-hover/menu-button:visible">
										<Kbd>{formatForDisplay(shortcuts.toggleSidebar)}</Kbd>
									</SidebarMenuBadge>
								</SidebarMenuItem>
							</SidebarMenu>
						</SidebarFooter>
					</div>
				</Sidebar>
			</div>
		</SidebarContext>
	);
}
