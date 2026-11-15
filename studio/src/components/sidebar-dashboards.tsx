import { Link, useMatchRoute, useNavigate } from '@tanstack/react-router';
import { EllipsisIcon, LayoutDashboardIcon, PencilIcon, PlusIcon, XIcon } from 'lucide-react';
import { PointerActivationConstraints } from '@dnd-kit/dom';
import { DragDropProvider, KeyboardSensor, PointerSensor } from '@dnd-kit/react';
import { isSortable, useSortable } from '@dnd-kit/react/sortable';
import { useState } from 'react';
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
import {
	createDashboard,
	type Dashboard,
	deleteDashboard,
	moveDashboard,
	renameDashboard,
	useDashboards,
} from '@/dashboards';

const sensors = [
	// Only start dragging once the pointer moves, so clicking a dashboard still opens it
	PointerSensor.configure({ activationConstraints: [new PointerActivationConstraints.Distance({ value: 5 })] }),
	// Enter opens the focused dashboard, so only Space picks it up
	KeyboardSensor.configure({ keyboardCodes: { ...KeyboardSensor.defaults.keyboardCodes, start: ['Space'] } }),
];

export function SidebarDashboards() {
	const dashboards = useDashboards();
	const navigate = useNavigate();
	const [closing, setClosing] = useState<Dashboard>();
	const [confirmOpen, setConfirmOpen] = useState(false);

	return (
		<SidebarGroup>
			<SidebarGroupLabel>Dashboards</SidebarGroupLabel>
			<SidebarGroupAction
				title="New dashboard"
				onClick={() => {
					const { id } = createDashboard();
					void navigate({ to: '/dashboards/$dashboardId', params: { dashboardId: id } });
				}}
			>
				<PlusIcon />
				<span className="sr-only">New dashboard</span>
			</SidebarGroupAction>
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
								setClosing(dashboard);
								setConfirmOpen(true);
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

	return (
		<SidebarMenuItem ref={ref}>
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
		</SidebarMenuItem>
	);
}
