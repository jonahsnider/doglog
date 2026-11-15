import { useFormatForDisplay } from '@tanstack/react-hotkeys';
import { Link, useMatchRoute, useRouter } from '@tanstack/react-router';
import { EllipsisIcon, LayoutDashboardIcon, PencilIcon, PlusIcon, Trash2Icon, XIcon } from 'lucide-react';
import { PointerActivationConstraints } from '@dnd-kit/dom';
import { DragDropProvider, KeyboardSensor, PointerSensor } from '@dnd-kit/react';
import { isSortable, useSortable } from '@dnd-kit/react/sortable';
import { useState } from 'react';
import { AppContextMenu, type MenuEntry } from '@/components/app-context-menu';
import {
	AlertDialog,
	AlertDialogClose,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogPopup,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { Menu, MenuItem, MenuPopup, MenuTrigger } from '@/components/ui/menu';
import {
	SidebarGroup,
	SidebarGroupAction,
	SidebarGroupLabel,
	SidebarInput,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuButton,
	SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { newDashboard, shortcuts } from '@/commands';
import { type Dashboard, deleteDashboard, moveDashboard, renameDashboard, useDashboards } from '@/dashboards';
import { hasWidgets } from '@/pane-layout';

const sensors = [
	// Only start dragging once the pointer moves, so clicking a dashboard still opens it
	PointerSensor.configure({ activationConstraints: [new PointerActivationConstraints.Distance({ value: 5 })] }),
	// Enter opens the focused dashboard, so only Space picks it up
	KeyboardSensor.configure({ keyboardCodes: { ...KeyboardSensor.defaults.keyboardCodes, start: ['Space'] } }),
];

export function SidebarDashboards() {
	const dashboards = useDashboards();
	const router = useRouter();
	const formatForDisplay = useFormatForDisplay();
	const [closing, setClosing] = useState<Dashboard>();
	const [confirmOpen, setConfirmOpen] = useState(false);

	const addDashboard = () => newDashboard(router);
	const addDashboardTooltip = (
		<span className="flex items-center gap-2">
			New dashboard
			<Kbd>{formatForDisplay(shortcuts.newDashboard)}</Kbd>
		</span>
	);

	return (
		<SidebarGroup>
			<SidebarGroupLabel>Dashboards</SidebarGroupLabel>
			<Tooltip>
				<TooltipTrigger render={<SidebarGroupAction onClick={addDashboard} />}>
					<PlusIcon />
					<span className="sr-only">New dashboard</span>
				</TooltipTrigger>
				<TooltipPopup>{addDashboardTooltip}</TooltipPopup>
			</Tooltip>
			{/* Takes the place of the label and its action when the sidebar only shows icons */}
			<SidebarMenu className="hidden group-data-[collapsible=icon]:flex">
				<SidebarMenuItem>
					<SidebarMenuButton tooltip={{ children: addDashboardTooltip }} onClick={addDashboard}>
						<PlusIcon />
						<span>New dashboard</span>
					</SidebarMenuButton>
				</SidebarMenuItem>
			</SidebarMenu>
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
					{dashboards.map((dashboard, index) => (
						<DashboardItem
							key={dashboard.id}
							dashboard={dashboard}
							index={index}
							onClose={() => {
								// Nothing would be lost, so there's nothing to confirm
								if (hasWidgets(dashboard.layout)) {
									setClosing(dashboard);
									setConfirmOpen(true);
								} else {
									deleteDashboard(dashboard.id);
								}
							}}
						/>
					))}
				</SidebarMenu>
			</DragDropProvider>
			<AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
				<AlertDialogPopup>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete {closing?.name}?</AlertDialogTitle>
						<AlertDialogDescription>
							Closing a dashboard permanently deletes it, including its panes and widgets.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogClose render={<Button variant="ghost" />}>Cancel</AlertDialogClose>
						<AlertDialogClose
							render={<Button variant="destructive" />}
							onClick={() => {
								if (closing) {
									deleteDashboard(closing.id);
								}
							}}
						>
							Delete
						</AlertDialogClose>
					</AlertDialogFooter>
				</AlertDialogPopup>
			</AlertDialog>
		</SidebarGroup>
	);
}

function DashboardItem({ dashboard, index, onClose }: { dashboard: Dashboard; index: number; onClose: () => void }) {
	const matchRoute = useMatchRoute();
	const [renaming, setRenaming] = useState(false);
	const { ref, handleRef } = useSortable({ id: dashboard.id, index, disabled: renaming });
	const menuItems: MenuEntry[] = [
		{ label: 'Rename', icon: PencilIcon, onSelect: () => setRenaming(true) },
		{ label: 'Delete', icon: Trash2Icon, destructive: true, onSelect: onClose },
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
						tooltip={dashboard.name}
					>
						<LayoutDashboardIcon />
						<span>{dashboard.name}</span>
					</SidebarMenuButton>
					<Menu>
						<MenuTrigger render={<SidebarMenuAction showOnHover />}>
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
							</MenuItem>
						</MenuPopup>
					</Menu>
				</>
			)}
		</AppContextMenu>
	);
}
