import { useFormatForDisplay } from '@tanstack/react-hotkeys';
import { Link, useLocation, useRouter } from '@tanstack/react-router';
import { LayoutDashboardIcon, PlusIcon } from 'lucide-react';
import { useSortable } from '@dnd-kit/react/sortable';
import { AnimatePresence, domAnimation, LazyMotion, m, useIsPresent, useReducedMotion } from 'motion/react';
import { type MouseEvent, useRef, useState } from 'react';
import { AppContextMenu, type MenuAction } from '@/components/app-context-menu';
import { DashboardOptions } from '@/sidebar/dashboard-options';
import {
	SidebarGroup,
	SidebarInput,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
} from '@/components/ui/sidebar';
import { TooltipLabel } from '@/components/tooltip-label';
import { DashboardPreview } from '@/dashboards/dashboard-preview';
import { NewDashboardPlaceholder } from '@/sidebar/new-dashboard-placeholder';
import { PreviewCard, PreviewCardPopup, PreviewCardTrigger } from '@/components/ui/preview-card';
import { Kbd } from '@/components/ui/kbd';
import { dashboardShortcut, newDashboard, shortcuts, useShortcutHint } from '@/commands/commands';
import { dashboardDragType, dashboardSensors } from '@/dashboards/drag';
import { dashboardName, mainWidgetType, suggestDashboardName } from '@/dashboards/label';
import {
	type Dashboard,
	deleteDashboard,
	deleteDashboards,
	renameDashboard,
	useDashboards,
} from '@/dashboards/dashboards';
import { useDragging, useNewDashboardDrop } from '@/sidebar/drag';
import { type DashboardSelection, useDashboardSelection } from '@/sidebar/selection';
import { cn } from '@/lib/utils';

const MotionSidebarMenuItem = m.create(SidebarMenuItem);

/** Dashboards and the new dashboard button handle their own clicks */
function isEmptySpace(event: MouseEvent): boolean {
	return event.target instanceof Element && !event.target.closest('[data-sidebar="menu-item"]');
}

export function SidebarDashboards() {
	const dashboards = useDashboards();
	const router = useRouter();
	const selection = useDashboardSelection(dashboards);
	const listRef = useRef<HTMLUListElement>(null);
	const placeholderRef = useRef<HTMLLIElement>(null);
	// Panes dropped anywhere on the dashboards move to a new dashboard
	const { ref, dropIndex } = useNewDashboardDrop(listRef, placeholderRef);
	const dragging = useDragging();
	const items = dashboards.map((dashboard, index) => (
		<DashboardItem
			key={dashboard.id}
			dashboard={dashboard}
			dashboards={dashboards}
			index={index}
			selection={selection}
		/>
	));
	if (dropIndex !== undefined) {
		items.splice(dropIndex, 0, <NewDashboardPlaceholder key="new-dashboard" ref={placeholderRef} />);
	}

	return (
		// Fills the rest of the sidebar so the empty space below the list can be double-clicked
		<SidebarGroup
			ref={ref}
			className="flex-1"
			onClick={(event) => {
				if (isEmptySpace(event)) {
					selection.clear();
				}
			}}
			onDoubleClick={(event) => {
				if (isEmptySpace(event)) {
					newDashboard(router, 'bottom');
				}
			}}
		>
			{/* Dragged dashboards and panes are dropped by `DragProvider` */}
			{/* Tooltips and previews would open on the dashboards the pointer passes over */}
			<SidebarMenu ref={listRef} className={cn(dragging && 'pointer-events-none')}>
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
					<AnimatePresence initial={false}>{items}</AnimatePresence>
				</LazyMotion>
			</SidebarMenu>
		</SidebarGroup>
	);
}

function DashboardItem({
	dashboard,
	dashboards,
	index,
	selection,
}: {
	dashboard: Dashboard;
	dashboards: Dashboard[];
	index: number;
	selection: DashboardSelection;
}) {
	// Closed dashboards stay rendered while they slide away, but can't be selected or dragged
	const present = useIsPresent();
	// Follows navigations as soon as they start, so the selection changes in the same frame as the list
	const pathname = useLocation({ select: (location) => location.pathname });
	const active = present && pathname === `/dashboards/${dashboard.id}`;
	const [renaming, setRenaming] = useState(false);
	const { ref, handleRef } = useSortable({
		id: dashboard.id,
		index,
		type: dashboardDragType,
		accept: dashboardDragType,
		sensors: dashboardSensors,
		disabled: renaming || !present,
	});
	const transition = (useReducedMotion() ?? false) ? { duration: 0 } : { duration: 0.2, ease: 'easeInOut' as const };
	const shortcut = dashboardShortcut(index);
	// Holding the shortcut's modifier shows every dashboard's shortcut in place of its options button
	const showShortcut = useShortcutHint(shortcut);
	const formatForDisplay = useFormatForDisplay();
	const name = dashboardName(dashboard);
	const Icon = mainWidgetType(dashboard.layout)?.icon ?? LayoutDashboardIcon;
	// Disabled rather than hidden like in a browser's tab menu, so the menu's layout doesn't shift
	const isOnly = dashboards.length === 1;
	const isLast = index === dashboards.length - 1;
	const closeOthers = () =>
		deleteDashboards(dashboards.filter((other) => other !== dashboard).map((other) => other.id));
	const closeBelow = () => deleteDashboards(dashboards.slice(index + 1).map((other) => other.id));
	const selected = selection.isSelected(dashboard);
	const menuItems: (MenuAction | 'separator')[] = selected
		? selection.menuItems
		: [
				{ label: 'Rename', onSelect: () => setRenaming(true) },
				{ label: 'Duplicate', onSelect: () => selection.duplicate([dashboard.id]) },
				'separator',
				{
					label: 'Close',
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
					// Lets `useNewDashboardDrop()` find where a dropped pane goes
					data-dashboard-index={index}
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
										className={cn(selected && 'bg-sidebar-accent text-sidebar-accent-foreground')}
										render={<Link to="/dashboards/$dashboardId" params={{ dashboardId: dashboard.id }} />}
										onClick={(event) => {
											// Instead of opening the link in a new tab or window
											if (selection.click(event, dashboard)) {
												event.preventDefault();
											}
										}}
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
						<DashboardOptions items={menuItems} hidden={showShortcut} />
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
