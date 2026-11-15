import { useFormatForDisplay, useHotkey } from '@tanstack/react-hotkeys';
import { Link, useMatchRoute } from '@tanstack/react-router';
import { useSelector } from '@tanstack/react-store';
import { FolderSyncIcon, PanelLeftCloseIcon, PanelLeftOpenIcon, SettingsIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as z from 'zod';
import { Kbd } from '@/components/ui/kbd';
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
import { SourceControl } from '@/components/source-control';
import { SidebarDashboards } from '@/components/sidebar-dashboards';
import { createPersistedAtom } from '@/lib/persisted-store';
import { cn } from '@/lib/utils';

const collapsedStore = createPersistedAtom('sidebar-collapsed', z.boolean(), false);

const shortcut = 'Mod+B';
/** How long the pointer has to stay on or away from the collapsed sidebar before it's shown or hidden */
const peekDelay = 300;
/** Keeps the peeking sidebar open while the pointer is elsewhere: an open menu, renaming a dashboard, or dragging one */
const keepPeekingSelector = '[data-slot="menu-trigger"][data-popup-open], input:focus, [data-dnd-dragging]';

function noop(): void {}

export function AppSidebar() {
	const matchRoute = useMatchRoute();
	const formatForDisplay = useFormatForDisplay();
	const collapsed = useSelector(collapsedStore);
	// Showing the collapsed sidebar over the dashboard while it's hovered
	const [peeking, setPeeking] = useState(false);
	const showTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
	const sidebarRef = useRef<HTMLDivElement>(null);
	const iconOnly = collapsed && !peeking;

	const toggle = () => {
		clearTimeout(showTimer.current);
		setPeeking(false);
		collapsedStore.set((value) => !value);
	};
	useHotkey(shortcut, toggle, { requireReset: true });

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
		setOpen: (open) => collapsedStore.set(!open),
		openMobile: false,
		setOpenMobile: noop,
		isMobile: false,
		toggleSidebar: toggle,
	};

	const toggleLabel = collapsed ? 'Expand sidebar' : 'Collapse sidebar';

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
						'group absolute inset-y-0 start-0 z-20 overflow-hidden border-r transition-[width,box-shadow] duration-200 ease-linear motion-reduce:transition-none',
						iconOnly && 'w-(--sidebar-width-icon)',
						collapsed && peeking && 'shadow-lg',
					)}
					onPointerEnter={(event) => {
						if (collapsed && !peeking && event.pointerType !== 'touch') {
							showTimer.current = setTimeout(() => setPeeking(true), peekDelay);
						}
					}}
					onPointerLeave={() => clearTimeout(showTimer.current)}
				>
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
									<SidebarMenuButton
										isActive={Boolean(matchRoute({ to: '/logs' }))}
										render={<Link to="/logs" />}
										tooltip="Logs"
									>
										<FolderSyncIcon />
										<span>Logs</span>
									</SidebarMenuButton>
									<SidebarMenuBadge>Soon</SidebarMenuBadge>
								</SidebarMenuItem>
								<SidebarMenuItem>
									<SidebarMenuButton
										isActive={Boolean(matchRoute({ to: '/settings' }))}
										render={<Link to="/settings" />}
										tooltip="Settings"
									>
										<SettingsIcon />
										<span>Settings</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							</SidebarMenu>
						</SidebarGroup>
						<SidebarDashboards />
					</SidebarContent>
					<SidebarFooter>
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton
									aria-expanded={!collapsed}
									onClick={toggle}
									tooltip={{
										children: (
											<span className="flex items-center gap-2">
												{toggleLabel}
												<Kbd>{formatForDisplay(shortcut)}</Kbd>
											</span>
										),
									}}
								>
									{collapsed ? <PanelLeftOpenIcon /> : <PanelLeftCloseIcon />}
									<span>{toggleLabel}</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarFooter>
				</Sidebar>
			</div>
		</SidebarContext>
	);
}
