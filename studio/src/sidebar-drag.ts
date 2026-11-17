import { useDragDropMonitor, useDroppable } from '@dnd-kit/react';
import { type RefObject, useState } from 'react';
import { type NewDashboardDropData, paneDragType } from '@/pane-drag';

const newDashboardId = 'new-dashboard';

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
 * Lets panes be dropped on the sidebar's dashboards to move them to a new dashboard, added where the pointer is.
 * Attach `ref` to the drop area, and render a placeholder at `dropIndex` (`undefined` when no pane is over it) in `list`,
 * whose dashboards are marked with `data-dashboard-index`.
 */
export function useNewDashboardDrop(list: RefObject<HTMLElement | null>, placeholder: RefObject<HTMLElement | null>) {
	const [index, setIndex] = useState(0);
	const { ref, isDropTarget } = useDroppable<NewDashboardDropData>({
		id: newDashboardId,
		accept: paneDragType,
		data: { kind: 'new-dashboard', index },
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
	return { ref, dropIndex: isDropTarget ? index : undefined };
}
