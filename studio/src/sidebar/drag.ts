import { useDragDropMonitor, useDragOperation, useDroppable } from '@dnd-kit/react';
import { type RefObject, useState } from 'react';
import { dashboardDragType } from '@/dashboards/drag';
import { type NewDashboardDropData, paneDragType } from '@/panes/drag';

/** What's being dragged over a section of the sidebar */
export type DraggedKind = 'pane' | 'dashboard';

/** Whether anything is being dragged, so the sidebar's dashboards don't show tooltips and previews while they're passed over */
export function useDragging(): boolean {
	const [dragging, setDragging] = useState(false);
	useDragDropMonitor({
		onDragStart: () => setDragging(true),
		onDragEnd: () => setDragging(false),
	});
	return dragging;
}

/**
 * Lets panes be dropped on the sidebar's shared dashboards or the others to move them to a new dashboard, and dashboards
 * from the other section to move them over, added where the pointer is. Attach `ref` to the drop area, and render a
 * placeholder at `dropIndex` (`undefined` when nothing is over it) in `list`, whose dashboards are marked with
 * `data-dashboard-index`. `dragged` is what's being dragged, if it could be dropped here.
 */
export function useNewDashboardDrop(
	list: RefObject<HTMLElement | null>,
	placeholder: RefObject<HTMLElement | null>,
	shared: boolean,
) {
	const [index, setIndex] = useState(0);
	const newDashboardId = shared ? 'new-shared-dashboard' : 'new-dashboard';
	// Dashboards are reordered within their own section by sorting them
	const accept = (source: { type?: unknown; data: Record<string, unknown> }) =>
		source.type === paneDragType || (source.type === dashboardDragType && source.data['shared'] !== shared);
	const { source } = useDragOperation();
	const { ref, isDropTarget } = useDroppable<NewDashboardDropData>({
		id: newDashboardId,
		accept,
		data: { kind: 'new-dashboard', shared, index },
	});
	useDragDropMonitor({
		onDragMove: ({ operation }) => {
			if (operation.target?.id !== newDashboardId || !list.current) {
				return;
			}

			// Dashboards after the placeholder are pushed down by it, so they're measured as if it wasn't there
			const next = placeholder.current?.nextElementSibling;
			const shift =
				placeholder.current && next
					? next.getBoundingClientRect().top - placeholder.current.getBoundingClientRect().top
					: 0;
			const { y } = operation.position.current;
			const above = [...list.current.querySelectorAll<HTMLElement>('[data-dashboard-index]')].filter((item) => {
				const rect = item.getBoundingClientRect();
				const top = Number(item.dataset['dashboardIndex']) >= index ? rect.top - shift : rect.top;
				return y > top + rect.height / 2;
			});
			if (above.length !== index) {
				setIndex(above.length);
			}
		},
	});
	const dragged: DraggedKind | undefined =
		source && accept(source) ? (source.type === paneDragType ? 'pane' : 'dashboard') : undefined;
	return { ref, dropIndex: isDropTarget ? index : undefined, dragged };
}
