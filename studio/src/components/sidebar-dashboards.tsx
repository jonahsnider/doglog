import { useFormatForDisplay, useHotkeyHint } from '@tanstack/react-hotkeys';
import { Link, useMatchRoute, useRouter } from '@tanstack/react-router';
import { EllipsisIcon, LayoutDashboardIcon, PencilIcon, PlusIcon, Trash2Icon, XIcon } from 'lucide-react';
import { PointerActivationConstraints } from '@dnd-kit/dom';
import { DragDropProvider, KeyboardSensor, PointerSensor } from '@dnd-kit/react';
import { isSortable, useSortable } from '@dnd-kit/react/sortable';
import { useState } from 'react';
import { useDebounceValue } from 'usehooks-ts';
import { AppContextMenu, type MenuEntry } from '@/components/app-context-menu';
import { closeDashboard } from '@/close-dashboard';
import { Menu, MenuItem, MenuPopup, MenuShortcut, MenuTrigger } from '@/components/ui/menu';
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarInput,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
} from '@/components/ui/sidebar';
import { TooltipLabel } from '@/components/tooltip-label';
import { Kbd } from '@/components/ui/kbd';
import { dashboardShortcut, newDashboard, shortcuts } from '@/commands';
import { type Dashboard, moveDashboard, renameDashboard, useDashboards } from '@/dashboards';

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
			<SidebarGroupLabel>Dashboards</SidebarGroupLabel>
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
							tooltip={{ children: <TooltipLabel label="New dashboard" shortcut={shortcuts.newDashboard} /> }}
							onClick={() => newDashboard(router)}
						>
							<PlusIcon />
							<span>New dashboard</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
					{dashboards.map((dashboard, index) => (
						<DashboardItem
							key={dashboard.id}
							dashboard={dashboard}
							index={index}
							onClose={() => closeDashboard(dashboard)}
						/>
					))}
				</SidebarMenu>
			</DragDropProvider>
		</SidebarGroup>
	);
}

function DashboardItem({ dashboard, index, onClose }: { dashboard: Dashboard; index: number; onClose: () => void }) {
	const matchRoute = useMatchRoute();
	const [renaming, setRenaming] = useState(false);
	const { ref, handleRef } = useSortable({ id: dashboard.id, index, disabled: renaming });
	const shortcut = dashboardShortcut(index);
	// Holding the shortcut's modifier shows every dashboard's shortcut in place of its options button
	const shortcutHinted = useHotkeyHint(shortcut);
	// Waits a moment so quickly pressing a shortcut doesn't flash the hints
	const [hintDelayed] = useDebounceValue(shortcutHinted, 300);
	const showShortcut = shortcutHinted && hintDelayed;
	const formatForDisplay = useFormatForDisplay();
	const menuItems: MenuEntry[] = [
		{ label: 'Rename', icon: PencilIcon, onSelect: () => setRenaming(true) },
		{ label: 'Delete', icon: Trash2Icon, shortcut: shortcuts.closeDashboard, destructive: true, onSelect: onClose },
	];

	return (
		// The input keeps the browser's menu while renaming
		<AppContextMenu items={menuItems} render={<SidebarMenuItem ref={ref} />} disabled={renaming}>
			{renaming ? (
				<SidebarInput
					aria-label="Dashboard name"
					defaultValue={dashboard.name}
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
							event.currentTarget.value = dashboard.name;
							event.currentTarget.blur();
						}
					}}
				/>
			) : (
				<>
					<SidebarMenuButton
						isActive={Boolean(matchRoute({ to: '/dashboards/$dashboardId', params: { dashboardId: dashboard.id } }))}
						render={<Link to="/dashboards/$dashboardId" params={{ dashboardId: dashboard.id }} />}
						ref={handleRef}
						// Keeps the link a link, dnd-kit makes drag handles without a role into buttons
						role="link"
						onDoubleClick={() => setRenaming(true)}
						tooltip={{ children: <TooltipLabel label={dashboard.name} shortcut={shortcut} /> }}
					>
						<LayoutDashboardIcon />
						<span>{dashboard.name}</span>
					</SidebarMenuButton>
					<Menu>
						<MenuTrigger render={<SidebarMenuAction showOnHover className={showShortcut ? 'invisible' : undefined} />}>
							<EllipsisIcon />
							<span className="sr-only">Dashboard options</span>
						</MenuTrigger>
						<MenuPopup align="start" side="right">
							<MenuItem onClick={() => setRenaming(true)}>
								<PencilIcon />
								Rename
							</MenuItem>
							<MenuItem variant="destructive" onClick={onClose}>
								<XIcon />
								Close dashboard
								<MenuShortcut>{formatForDisplay(shortcuts.closeDashboard)}</MenuShortcut>
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
		</AppContextMenu>
	);
}
