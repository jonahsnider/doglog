import { type Hotkey, useFormatForDisplay } from '@tanstack/react-hotkeys';
import { Link, type RegisteredRouter, useLocation, useRouter } from '@tanstack/react-router';
import LayoutDashboardIcon from 'lucide-react/icons/layout-dashboard';
import { useSortable } from '@dnd-kit/react/sortable';
import { m, useIsPresent } from 'motion/react';
import { easing, useMotionTransition } from '@/lib/motion';
import { type ComponentType, type SVGProps, useState } from 'react';
import { AppContextMenu, type MenuAction } from '@/components/app-context-menu';
import { DashboardOptions } from '@/sidebar/dashboard-options';
import { SidebarInput, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { TooltipLabel } from '@/components/tooltip-label';
import { DashboardPreview } from '@/dashboards/dashboard-preview';
import { PreviewCard, PreviewCardPopup, PreviewCardTrigger } from '@/components/ui/preview-card';
import { Kbd } from '@/components/ui/kbd';
import { dashboardShortcut, shortcuts, useShortcutHint } from '@/commands/commands';
import { moveDashboardToSection } from '@/dashboards/sharing';
import { type DashboardDragData, dashboardDragType, dashboardSensors } from '@/dashboards/drag';
import { dashboardName, mainWidgetType, suggestDashboardName } from '@/dashboards/label';
import { type Dashboard, deleteDashboard, deleteDashboards, renameDashboard } from '@/dashboards/dashboards';
import type { DashboardSelection } from '@/sidebar/selection';
import { isEnterKey } from '@/lib/keyboard';
import { cn } from '@/lib/utils';
import { DashboardPresence } from '@/sharing/presence-avatars';

const MotionSidebarMenuItem = m.create(SidebarMenuItem);

function ItemEnd({
	dashboard,
	shortcut,
	menuItems,
}: {
	dashboard: Dashboard;
	shortcut: Hotkey | undefined;
	menuItems: readonly (MenuAction | 'separator')[];
}) {
	const showShortcut = useShortcutHint(shortcut);
	const formatForDisplay = useFormatForDisplay();
	return (
		<>
			{dashboard.shared && !showShortcut && (
				<SidebarMenuBadge className="group-focus-within/menu-item:invisible group-hover/menu-item:invisible">
					<DashboardPresence dashboardId={dashboard.id} />
				</SidebarMenuBadge>
			)}
			<DashboardOptions items={menuItems} hidden={showShortcut} />
			{showShortcut && shortcut !== undefined && (
				<SidebarMenuBadge>
					<Kbd>{formatForDisplay(shortcut)}</Kbd>
				</SidebarMenuBadge>
			)}
		</>
	);
}

function useItemTransitions(isDragSource: boolean) {
	const transition = useMotionTransition({ duration: 0.2, ease: easing.inOut });
	// Dashboards dragged to the other section are hidden right away, so only the gap they leave closes
	const exitTransition = isDragSource ? { ...transition, opacity: { duration: 0 } } : transition;
	return { transition, exitTransition };
}

/** Lets a dashboard be dragged by its link to reorder it, or to the other section to share or unshare it */
function useDashboardSortable(dashboard: Dashboard, sectionIndex: number, renaming: boolean, present: boolean) {
	const [item, setItem] = useState<HTMLElement | null>(null);
	const { handleRef, isDragSource } = useSortable({
		// Left out while renaming, since dnd-kit would make the item its drag handle in place of the unmounted link,
		// and never remove the tab stop and ARIA attributes it adds
		element: renaming ? null : item,
		// Sharing a dashboard keeps its ID, so the one that shows up in the shared section would take over the drop otherwise
		id: `${dashboard.shared ? 'shared' : 'local'}-${dashboard.id}`,
		index: sectionIndex,
		group: dashboard.shared ? 'shared' : 'local',
		type: dashboardDragType,
		// Dropping a dashboard in the other section shares or unshares it, see `useNewDashboardDrop()`
		accept: (source) => source.type === dashboardDragType && source.data['shared'] === dashboard.shared,
		data: { dashboardId: dashboard.id, shared: dashboard.shared } satisfies DashboardDragData,
		sensors: dashboardSensors,
		disabled: renaming || !present,
	});
	return { setItem, handleRef, isDragSource };
}

function RenameInput({
	dashboard,
	icon: Icon,
	onDone,
}: {
	dashboard: Dashboard;
	icon: ComponentType<SVGProps<SVGSVGElement>>;
	onDone: () => void;
}) {
	const [initialName] = useState(() => dashboardName(dashboard));
	return (
		<div className="relative">
			<SidebarInput
				// Leaves room for the icon, so the name stays where it was in the link (p-2, a size-4 icon, and gap-2, less the border)
				className="[&>input]:ps-[calc(--spacing(8)-1px)]"
				aria-label="Dashboard name"
				defaultValue={initialName}
				placeholder={suggestDashboardName(dashboard.layout)}
				autoFocus
				onFocus={(event) => event.currentTarget.select()}
				onBlur={(event) => {
					// An unchanged suggested name isn't saved, so it keeps following the dashboard's contents
					if (event.currentTarget.value !== initialName) {
						renameDashboard(dashboard.id, event.currentTarget.value);
					}
					onDone();
				}}
				onKeyDown={(event) => {
					if (isEnterKey(event)) {
						event.currentTarget.blur();
					} else if (event.key === 'Escape') {
						event.currentTarget.value = initialName;
						event.currentTarget.blur();
					}
				}}
			/>
			<Icon className="pointer-events-none absolute top-2 left-2 size-4" />
		</div>
	);
}

function dashboardMenu({
	dashboard,
	dashboards,
	index,
	selection,
	router,
	rename,
}: {
	dashboard: Dashboard;
	dashboards: Dashboard[];
	index: number;
	selection: DashboardSelection;
	router: RegisteredRouter;
	rename: () => void;
}): (MenuAction | 'separator')[] {
	const closeOthers = () =>
		deleteDashboards(dashboards.filter((other) => other !== dashboard).map((other) => other.id));
	const closeBelow = () => deleteDashboards(dashboards.slice(index + 1).map((other) => other.id));
	// Disabled rather than hidden like in a browser's tab menu, so the menu's layout doesn't shift
	return [
		{ label: 'Rename', onSelect: rename },
		{ label: 'Duplicate', onSelect: () => selection.duplicate([dashboard.id]) },
		{
			label: dashboard.shared ? 'Stop sharing' : 'Share',
			onSelect: () => {
				moveDashboardToSection(router, dashboard.id, !dashboard.shared);
			},
		},
		'separator',
		{
			label: 'Close',
			shortcut: shortcuts.closeDashboard,
			destructive: true,
			onSelect: () => deleteDashboard(dashboard.id),
		},
		{ label: 'Close other dashboards', disabled: dashboards.length === 1, onSelect: closeOthers },
		{ label: 'Close dashboards below', disabled: index === dashboards.length - 1, onSelect: closeBelow },
	];
}

export function DashboardItem({
	dashboard,
	dashboards,
	index,
	sectionIndex,
	selection,
	appear,
}: {
	dashboard: Dashboard;
	dashboards: Dashboard[];
	/** Position in the sidebar */
	index: number;
	/** Position among the shared dashboards or the others */
	sectionIndex: number;
	selection: DashboardSelection;
	/** Whether it slides in when added, instead of showing up in full in place of the drop placeholder */
	appear: boolean;
}) {
	const router = useRouter();
	// Closed dashboards stay rendered while they slide away, but can't be selected or dragged
	const present = useIsPresent();
	// Follows navigations as soon as they start, so the selection changes in the same frame as the list
	const pathname = useLocation({ select: (location) => location.pathname });
	const active = present && pathname === `/dashboards/${dashboard.id}`;
	const [renaming, setRenaming] = useState(false);
	const { setItem, handleRef, isDragSource } = useDashboardSortable(dashboard, sectionIndex, renaming, present);
	// Closed while the dashboard is dragged, since the trigger moves with the pointer and the preview would follow it
	const [previewOpen, setPreviewOpen] = useState(false);
	if (isDragSource && previewOpen) {
		setPreviewOpen(false);
	}
	const { transition, exitTransition } = useItemTransitions(isDragSource);
	const shortcut = dashboardShortcut(index);
	const name = dashboardName(dashboard);
	const Icon = mainWidgetType(dashboard.layout)?.icon ?? LayoutDashboardIcon;
	const menuItems = selection.isSelected(dashboard)
		? selection.menuItems
		: dashboardMenu({ dashboard, dashboards, index, selection, router, rename: () => setRenaming(true) });

	return (
		// The input keeps the browser's menu while renaming
		<AppContextMenu
			items={menuItems}
			render={
				<MotionSidebarMenuItem
					ref={setItem}
					// Lets `useNewDashboardDrop()` find where a dropped pane goes
					data-dashboard-index={sectionIndex}
					// Opened dashboards show up in full on top of the one in their spot, which slides down from under them.
					// The negative margin cancels the menu's gap-1, so a collapsed dashboard takes up no space.
					// The height and margin animate so the dashboards below move with it, a short reflow of one short list
					// react-doctor-disable-next-line react-doctor/no-layout-property-animation -- Moves the dashboards below
					initial={appear && { height: 0, marginBottom: '-0.25rem', zIndex: 1 }}
					// react-doctor-disable-next-line react-doctor/no-layout-property-animation -- Moves the dashboards below
					animate={{ height: 'auto', marginBottom: '0rem', opacity: 1, transitionEnd: { zIndex: 'auto' } }}
					// Closed dashboards fade and slide up, clipped so they don't cover the one above
					// react-doctor-disable-next-line react-doctor/no-layout-property-animation -- Moves the dashboards below
					exit={{ height: 0, marginBottom: '-0.25rem', opacity: 0, overflow: 'hidden', transition: exitTransition }}
					transition={transition}
				/>
			}
			disabled={renaming}
		>
			<m.div
				// Opaque so an opened dashboard hides the one it covers, and rounded like the button so its corners don't show when dragged over other surfaces
				className="rounded-lg bg-sidebar"
				initial={false}
				animate={{ y: '0%' }}
				exit={{ y: '-100%' }}
				transition={transition}
			>
				{renaming ? (
					<RenameInput dashboard={dashboard} icon={Icon} onDone={() => setRenaming(false)} />
				) : (
					<>
						<PreviewCard open={previewOpen} onOpenChange={(open) => setPreviewOpen(open && !isDragSource)}>
							<PreviewCardTrigger
								render={
									<SidebarMenuButton
										isActive={active}
										className={cn(
											selection.isSelected(dashboard) && 'bg-sidebar-accent text-sidebar-accent-foreground',
										)}
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
						<ItemEnd dashboard={dashboard} shortcut={shortcut} menuItems={menuItems} />
					</>
				)}
			</m.div>
		</AppContextMenu>
	);
}
