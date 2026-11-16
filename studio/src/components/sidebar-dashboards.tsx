import { useFormatForDisplay, useHotkeyHint } from '@tanstack/react-hotkeys';
import { Link, useLocation, useRouter } from '@tanstack/react-router';
import { EllipsisIcon, LayoutDashboardIcon, PlusIcon } from 'lucide-react';
import { PointerActivationConstraints } from '@dnd-kit/dom';
import { DragDropProvider, KeyboardSensor, PointerSensor } from '@dnd-kit/react';
import { isSortable, useSortable } from '@dnd-kit/react/sortable';
import { AnimatePresence, domAnimation, LazyMotion, m, useIsPresent, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { useDebounceValue } from 'usehooks-ts';
import { AppContextMenu, type MenuEntry } from '@/components/app-context-menu';
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuShortcut, MenuTrigger } from '@/components/ui/menu';
import {
	SidebarGroup,
	SidebarInput,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
} from '@/components/ui/sidebar';
import { TooltipLabel } from '@/components/tooltip-label';
import { DashboardPreview } from '@/components/dashboard-preview';
import { PreviewCard, PreviewCardPopup, PreviewCardTrigger } from '@/components/ui/preview-card';
import { Kbd } from '@/components/ui/kbd';
import { dashboardShortcut, newDashboard, shortcuts } from '@/commands';
import { dashboardName, mainWidgetType, suggestDashboardName } from '@/dashboard-label';
import {
	type Dashboard,
	deleteDashboard,
	deleteDashboards,
	moveDashboard,
	renameDashboard,
	useDashboards,
} from '@/dashboards';

const MotionSidebarMenuItem = m.create(SidebarMenuItem);

const sensors = [
	// Only start dragging once the pointer moves, so clicking a dashboard still opens it
	PointerSensor.configure({ activationConstraints: [new PointerActivationConstraints.Distance({ value: 5 })] }),
	// Enter opens the focused dashboard, so only Space picks it up
	KeyboardSensor.configure({ keyboardCodes: { ...KeyboardSensor.defaults.keyboardCodes, start: ['Space'] } }),
];

export function SidebarDashboards() {
	const dashboards = useDashboards();
	const router = useRouter();

	return (
		// Fills the rest of the sidebar so the empty space below the list can be double-clicked
		<SidebarGroup
			className="flex-1"
			onDoubleClick={(event) => {
				// Dashboards and the new dashboard button handle their own clicks
				if (event.target instanceof Element && !event.target.closest('[data-sidebar="menu-item"]')) {
					newDashboard(router, 'bottom');
				}
			}}
		>
			<DragDropProvider
				sensors={sensors}
				onDragEnd={(event) => {
					const { source } = event.operation;
					if (!event.canceled && isSortable(source)) {
						moveDashboard(String(source.id), source.index);
					}
				}}
			>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							// Muted to set it apart from the dashboards below it
							className="text-sidebar-foreground/70 hover:text-sidebar-foreground/70 active:text-sidebar-foreground/70"
							tooltip={{ children: <TooltipLabel label="New dashboard" shortcut={shortcuts.newDashboard} /> }}
							onClick={() => newDashboard(router)}
						>
							<PlusIcon />
							<span>New dashboard</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
					{/* Like Dia, opened dashboards slide down out of the new dashboard button and closed ones slide back up */}
					<LazyMotion features={domAnimation} strict>
						<AnimatePresence initial={false}>
							{dashboards.map((dashboard, index) => (
								<DashboardItem key={dashboard.id} dashboard={dashboard} dashboards={dashboards} index={index} />
							))}
						</AnimatePresence>
					</LazyMotion>
				</SidebarMenu>
			</DragDropProvider>
		</SidebarGroup>
	);
}

function DashboardItem({
	dashboard,
	dashboards,
	index,
}: {
	dashboard: Dashboard;
	dashboards: Dashboard[];
	index: number;
}) {
	// Closed dashboards stay rendered while they slide away, but can't be selected or dragged
	const present = useIsPresent();
	// Follows navigations as soon as they start, so the selection changes in the same frame as the list
	const pathname = useLocation({ select: (location) => location.pathname });
	const active = present && pathname === `/dashboards/${dashboard.id}`;
	const [renaming, setRenaming] = useState(false);
	const [optionsOpen, setOptionsOpen] = useState(false);
	const { ref, handleRef } = useSortable({ id: dashboard.id, index, disabled: renaming || !present });
	const transition = (useReducedMotion() ?? false) ? { duration: 0 } : { duration: 0.2, ease: 'easeInOut' as const };
	const shortcut = dashboardShortcut(index);
	// Holding the shortcut's modifier shows every dashboard's shortcut in place of its options button
	const shortcutHinted = useHotkeyHint(shortcut);
	// Waits a moment so quickly pressing a shortcut doesn't flash the hints
	const [hintDelayed] = useDebounceValue(shortcutHinted, 300);
	const showShortcut = shortcutHinted && hintDelayed;
	const formatForDisplay = useFormatForDisplay();
	const name = dashboardName(dashboard);
	const Icon = mainWidgetType(dashboard.layout)?.icon ?? LayoutDashboardIcon;
	// Disabled rather than hidden like in a browser's tab menu, so the menu's layout doesn't shift
	const isOnly = dashboards.length === 1;
	const isLast = index === dashboards.length - 1;
	const closeOthers = () =>
		deleteDashboards(dashboards.filter((other) => other !== dashboard).map((other) => other.id));
	const closeBelow = () => deleteDashboards(dashboards.slice(index + 1).map((other) => other.id));
	const menuItems: MenuEntry[] = [
		{ label: 'Rename', onSelect: () => setRenaming(true) },
		'separator',
		{
			label: 'Close dashboard',
			shortcut: shortcuts.closeDashboard,
			destructive: true,
			onSelect: () => deleteDashboard(dashboard.id),
		},
		{ label: 'Close other dashboards', disabled: isOnly, onSelect: closeOthers },
		{ label: 'Close dashboards below', disabled: isLast, onSelect: closeBelow },
	];

	return (
		// The input keeps the browser's menu while renaming
		<AppContextMenu
			items={menuItems}
			render={
				<MotionSidebarMenuItem
					ref={ref}
					// Opened dashboards show up in full on top of the one in their spot, which slides down from under them.
					// The negative margin cancels the menu's gap-1, so a collapsed dashboard takes up no space.
					// The height and margin animate so the dashboards below move with it, a short reflow of one short list
					// react-doctor-disable-next-line react-doctor/no-layout-property-animation -- Moves the dashboards below
					initial={{ height: 0, marginBottom: '-0.25rem', zIndex: 1 }}
					// react-doctor-disable-next-line react-doctor/no-layout-property-animation -- Moves the dashboards below
					animate={{ height: 'auto', marginBottom: '0rem', opacity: 1, transitionEnd: { zIndex: 'auto' } }}
					// Closed dashboards fade and slide up, clipped so they don't cover the one above
					// react-doctor-disable-next-line react-doctor/no-layout-property-animation -- Moves the dashboards below
					exit={{ height: 0, marginBottom: '-0.25rem', opacity: 0, overflow: 'hidden' }}
					transition={transition}
				/>
			}
			disabled={renaming}
		>
			<m.div
				// Opaque so an opened dashboard hides the one it covers
				className="bg-sidebar"
				initial={false}
				animate={{ y: '0%' }}
				exit={{ y: '-100%' }}
				transition={transition}
			>
				{renaming ? (
					<SidebarInput
						aria-label="Dashboard name"
						// Starts blank for a suggested name, so it keeps following the dashboard's contents unless a name is typed
						defaultValue={dashboard.name ?? ''}
						placeholder={suggestDashboardName(dashboard.layout)}
						autoFocus
						onFocus={(event) => event.currentTarget.select()}
						onBlur={(event) => {
							renameDashboard(dashboard.id, event.currentTarget.value);
							setRenaming(false);
						}}
						onKeyDown={(event) => {
							if (event.key === 'Enter') {
								event.currentTarget.blur();
							} else if (event.key === 'Escape') {
								event.currentTarget.value = dashboard.name ?? '';
								event.currentTarget.blur();
							}
						}}
					/>
				) : (
					<>
						<PreviewCard>
							<PreviewCardTrigger
								render={
									<SidebarMenuButton
										isActive={active}
										render={<Link to="/dashboards/$dashboardId" params={{ dashboardId: dashboard.id }} />}
										ref={handleRef}
										// Keeps the link a link, dnd-kit makes drag handles without a role into buttons
										role="link"
										onDoubleClick={() => setRenaming(true)}
										// Closes the dashboard like a browser tab, instead of opening the link in a new one
										onAuxClick={(event) => {
											if (event.button === 1) {
												event.preventDefault();
												deleteDashboard(dashboard.id);
											}
										}}
										tooltip={{ children: <TooltipLabel label={name} shortcut={shortcut} /> }}
									/>
								}
							>
								<Icon />
								<span>{name}</span>
							</PreviewCardTrigger>
							{/* Only previews other dashboards, the selected one is already on screen. A single empty pane has nothing to preview. */}
							{!active && !(dashboard.layout.kind === 'pane' && dashboard.layout.widget === undefined) && (
								<PreviewCardPopup side="right" align="start" className="w-auto p-2">
									<DashboardPreview layout={dashboard.layout} />
								</PreviewCardPopup>
							)}
						</PreviewCard>
						<Menu open={optionsOpen} onOpenChange={setOptionsOpen}>
							<MenuTrigger
								render={<SidebarMenuAction showOnHover className={showShortcut ? 'invisible' : undefined} />}
								// The open menu doesn't cover its own button, so right-clicking it would open the context menu on top
								onContextMenu={() => setOptionsOpen(false)}
							>
								<EllipsisIcon />
								<span className="sr-only">Dashboard options</span>
							</MenuTrigger>
							<MenuPopup align="start" side="right">
								<MenuItem onClick={() => setRenaming(true)}>Rename</MenuItem>
								<MenuSeparator />
								<MenuItem variant="destructive" onClick={() => deleteDashboard(dashboard.id)}>
									Close dashboard
									<MenuShortcut>{formatForDisplay(shortcuts.closeDashboard)}</MenuShortcut>
								</MenuItem>
								<MenuItem disabled={isOnly} onClick={closeOthers}>
									Close other dashboards
								</MenuItem>
								<MenuItem disabled={isLast} onClick={closeBelow}>
									Close dashboards below
								</MenuItem>
							</MenuPopup>
						</Menu>
						{showShortcut && shortcut !== undefined && (
							<SidebarMenuBadge>
								<Kbd>{formatForDisplay(shortcut)}</Kbd>
							</SidebarMenuBadge>
						)}
					</>
				)}
			</m.div>
		</AppContextMenu>
	);
}
