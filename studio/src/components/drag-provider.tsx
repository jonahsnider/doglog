import { PointerActivationConstraints } from '@dnd-kit/dom';
import { DragDropProvider, DragOverlay, KeyboardSensor, PointerSensor } from '@dnd-kit/react';
import { isSortable } from '@dnd-kit/react/sortable';
import { LayoutDashboardIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { EntryName } from '@/components/entry-name';
import { combineDashboards, moveDashboardPane, movePaneToNewDashboard } from '@/dashboard-panes';
import { isDashboardDrag, isSplitZone } from '@/dashboard-drag';
import { moveDashboard } from '@/dashboards';
import { isEntryDrag } from '@/entry-drag';
import { isNewDashboardDrop, isPaneDrag, isPaneDrop, nearestSide, type PaneDragData } from '@/pane-drag';
import { getWidgetType } from '@/widgets/registry';

/** Sensors of entries, dashboards and panes use their own */
const sensors = [
	PointerSensor.configure({
		// Start once the pointer moves, so clicking a group still expands it
		activationConstraints: [new PointerActivationConstraints.Distance({ value: 5 })],
		// Rows for entries with children are mostly the expand button, allow dragging by it
		preventActivation: () => false,
	}),
	KeyboardSensor,
];

/**
 * Lets dashboards, panes, and entries be dragged anywhere in the app:
 * dashboards to reorder them or onto the open dashboard's split zones, panes beside other panes or onto the sidebar,
 * and entries onto widgets (handled by `DashboardPanes`).
 */
export function DragProvider({ children }: { children: ReactNode }) {
	return (
		<DragDropProvider
			sensors={sensors}
			onDragEnd={({ operation, canceled }) => {
				const { source, target } = operation;
				if (canceled || !source) {
					return;
				}

				const drop = target?.data;
				if (isPaneDrag(source)) {
					const { dashboardId, paneId } = source.data;
					if (isPaneDrop(drop) && target?.element) {
						const side = nearestSide(target.element.getBoundingClientRect(), operation.position.current);
						moveDashboardPane(dashboardId, paneId, drop.paneId, side);
					} else if (isNewDashboardDrop(drop)) {
						movePaneToNewDashboard(dashboardId, paneId, drop.index);
					}
				} else if (isDashboardDrag(source)) {
					if (isSplitZone(drop)) {
						combineDashboards(drop.dashboardId, String(source.id), drop.side);
					} else if (isSortable(source)) {
						moveDashboard(String(source.id), source.index);
					}
				}
			}}
		>
			{children}
			{/* Entry browser rows are virtualized and can unmount mid-drag, and panes are too big to drag around, so a preview follows the pointer instead. Dashboards move in the sidebar. */}
			<DragOverlay dropAnimation={null} disabled={(source) => !isEntryDrag(source) && !isPaneDrag(source)}>
				{(source) =>
					isPaneDrag(source) ? (
						<PanePreview data={source.data} />
					) : (
						isEntryDrag(source) && (
							<div className="w-max max-w-80 truncate rounded-md border bg-popover px-2 py-1 font-mono text-xs text-popover-foreground shadow-md">
								<EntryName name={source.data.name} />
							</div>
						)
					)
				}
			</DragOverlay>
		</DragDropProvider>
	);
}

function PanePreview({ data }: { data: PaneDragData }) {
	const type = data.widgetType === undefined ? undefined : getWidgetType(data.widgetType);
	const Icon = type?.icon ?? LayoutDashboardIcon;
	return (
		<div className="flex w-max items-center gap-1.5 rounded-lg border bg-popover px-3 py-2 text-xs font-medium text-popover-foreground shadow-lg">
			<Icon className="size-3.5" />
			{type?.name ?? 'Empty pane'}
		</div>
	);
}
