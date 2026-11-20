import { type Hotkey, useFormatForDisplay, useHotkey } from '@tanstack/react-hotkeys';
import { Link, useMatchRoute } from '@tanstack/react-router';
import { useSelector } from '@tanstack/react-store';
import CircleArrowUpIcon from 'lucide-react/icons/circle-arrow-up';
import FolderSyncIcon from 'lucide-react/icons/folder-sync';
import SettingsIcon from 'lucide-react/icons/settings';
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
import { useTitleBarStrip, useTrafficLights } from '@/desktop/title-bar';
import {
	animateSidebarPeek,
	isCollapsing,
	sidebarAnimationStore,
	sidebarCollapsedStore,
	toggleSidebarCollapsed,
} from '@/sidebar/sidebar';
import { useMotionTransition } from '@/lib/motion';
import { TitleBar } from '@/sidebar/title-bar';
import { installUpdate, updateTitle, useUpdate } from '@/updater';
import { useWindowColor } from '@/theme/window-color';
import { WhatsNewCard } from '@/changelog/whats-new-card';

const peekDelay = 300;
/** Keeps the peeking sidebar open while the pointer is elsewhere: an open menu, renaming a dashboard, or dragging one */
const keepPeekingSelector =
	'[data-slot="menu-trigger"][data-popup-open], [data-slot="context-menu-trigger"][data-popup-open], input:focus, [data-dnd-dragging]';

function noop(): void {}

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
	const [peeking, setPeeking] = useState(false);
	// Toggling with the keyboard skips the animation, clicking and peeking keep it
	const [animated, setAnimated] = useState(true);
	const showTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
	const sidebarRef = useRef<HTMLDivElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const iconOnly = collapsed && !peeking;
	const strip = useTitleBarStrip();
	const trafficLights = useTrafficLights();
	const animation = useSelector(sidebarAnimationStore);
	// Collapsing is expanding in reverse: the sidebar keeps its full layout while it shrinks, clipped like when it expands,
	// and only shows icons once it's done
	const iconLayout = iconOnly && !isCollapsing(animation);
	// Only read to skip the animation's steps when the system reduces motion
	const reduceMotion = useMotionTransition({ duration: 0.2 }).duration === 0;

	const toggle = (animate: boolean) => {
		clearTimeout(showTimer.current);
		setPeeking(false);
		setAnimated(animate);
		toggleSidebarCollapsed(animate, trafficLights);
	};

	const peek = () => {
		clearTimeout(showTimer.current);
		setAnimated(true);
		setPeeking(true);
		animateSidebarPeek(true);
	};
	useHotkey(shortcuts.toggleSidebar, () => toggle(false), { requireReset: true });

	// Check pointer moves since menus are rendered outside the sidebar, and pointerleave for exits from the window
	useEffect(() => {
		if (!peeking) {
			return undefined;
		}

		const hideOnPointerExit = (event: PointerEvent) => {
			const container = containerRef.current;
			if (
				!container ||
				(event.target instanceof Node && container.contains(event.target)) ||
				container.querySelector(keepPeekingSelector)
			) {
				return;
			}

			setPeeking(false);
			animateSidebarPeek(false);
		};

		document.addEventListener('pointermove', hideOnPointerExit);
		document.documentElement.addEventListener('pointerleave', hideOnPointerExit);
		return () => {
			document.removeEventListener('pointermove', hideOnPointerExit);
			document.documentElement.removeEventListener('pointerleave', hideOnPointerExit);
		};
	}, [peeking]);

	// Provided directly instead of using `SidebarProvider`, its open state is saved with `cookieStore`, which WebKit lacks
	const context: SidebarContextProps = {
		state: iconLayout ? 'collapsed' : 'expanded',
		open: !collapsed,
		setOpen: (open) => sidebarCollapsedStore.set(!open),
		openMobile: false,
		setOpenMobile: noop,
		isMobile: false,
		toggleSidebar: () => toggle(!reduceMotion),
	};

	return (
		<SidebarContext value={context}>
			{/* Reserves the sidebar's space in the layout, so peeking doesn't resize the dashboard */}
			<div
				ref={containerRef}
				className={cn(
					'relative shrink-0',
					collapsed ? 'w-(--sidebar-width-icon)' : 'w-(--sidebar-width)',
					// Resizes the main area along with the sidebar, like the timeline sliding up resizes the panes
					'transition-[width] duration-200 motion-reduce:transition-none',
					// The main area moves below the title bar's strip before the sidebar collapses
					'data-[animation=enter-strip]:w-(--sidebar-width) not-data-animation:transition-none',
				)}
				data-animation={animation}
			>
				<TitleBar collapsed={collapsed} iconOnly={iconOnly} onToggle={() => toggle(!reduceMotion)} />
				<Sidebar
					ref={sidebarRef}
					collapsible="none"
					data-collapsible={iconLayout ? 'icon' : undefined}
					// Opaque while it's over the panes, otherwise it can show the window's backdrop through the frame, see `index.css`
					data-peeking={collapsed && peeking ? '' : undefined}
					className={cn(
						'group absolute start-0 bottom-0 z-20 overflow-hidden transition-[width,box-shadow,background-color] duration-200 motion-reduce:transition-none',
						// Below the title bar's strip, lined up with the main area's panes and pages, which have a gap above them
						strip ? 'top-10.5' : 'top-0',
						// Sized by its top and bottom instead of `Sidebar`'s full height, which would push it past the bottom of the window below the strip
						'h-auto',
						// On the frame like the rest of the app's base, rounded for when it peeks over the panes
						'rounded-e-lg',
						iconOnly && 'w-(--sidebar-width-icon)',
						'data-peeking:shadow-lg',
						// The content is already at its full size, see below
						'[&_[data-sidebar=menu-button]]:transition-none',
						// Its width as it animates, for the menu buttons' corners, see `index.css`. The content is already contained.
						'@container',
						// Stays put until the main area is below the strip, then collapses
						'in-data-[animation=enter-strip]:top-0 in-data-[animation=enter-strip]:w-(--sidebar-width)',
						!animated && 'transition-none',
					)}
					onPointerEnter={(event) => {
						if (collapsed && !peeking && event.pointerType !== 'touch') {
							showTimer.current = setTimeout(peek, peekDelay);
						}
					}}
					onPointerLeave={() => clearTimeout(showTimer.current)}
				>
					{/* Like sliding panes, the content keeps its full width and is clipped, so it isn't laid out again every frame while the sidebar's width animates */}
					<div className="flex h-full w-(--sidebar-width) shrink-0 flex-col contain-strict group-data-[collapsible=icon]:w-(--sidebar-width-icon)">
						<SidebarHeader
							// Leaves room for the title bar, which is above the sidebar when it has its own strip
							// The items stay where they are in the rail below the strip, so they don't move when the sidebar expands
							className={cn(!strip && 'pt-12.5', 'in-data-[animation=enter-strip]:pt-12.5')}
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
											tooltip={updateTitle(update.update)}
										>
											{update.installing ? <Spinner /> : <CircleArrowUpIcon className="text-sidebar-primary" />}
											<span>{update.installing ? 'Updating…' : updateTitle(update.update)}</span>
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
