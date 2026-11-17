import { type Draggable, PointerActivationConstraints } from '@dnd-kit/dom';
import { KeyboardSensor, PointerSensor, useDraggable, useDroppable } from '@dnd-kit/react';
import type { Pane, PaneSide } from '@/pane-layout';

/** Drag type of panes, dragged by their header */
export const paneDragType = 'pane';

/** Data of a dragged pane */
export type PaneDragData = { dashboardId: string; paneId: string; widgetType: string | undefined };

/** Data of a pane that other panes can be dropped beside */
export type PaneDropData = { kind: 'pane'; paneId: string };

/** Data of the sidebar's dashboards, dropping a pane there moves it to a new dashboard at `index` */
export type NewDashboardDropData = { kind: 'new-dashboard'; index: number };

export function isPaneDrag(source: Draggable | null | undefined): source is Draggable<PaneDragData> {
	return source?.type === paneDragType;
}

export function isNewDashboardDrop(data: Record<string, unknown> | undefined): data is NewDashboardDropData {
	return data?.['kind'] === 'new-dashboard';
}

export function isPaneDrop(data: Record<string, unknown> | undefined): data is PaneDropData {
	return data?.['kind'] === 'pane';
}

const sensors = [
	// Only start once the pointer moves, so the header's buttons still get clicks
	PointerSensor.configure({ activationConstraints: [new PointerActivationConstraints.Distance({ value: 5 })] }),
	// The header becomes a button, so it can be picked up from the keyboard too
	KeyboardSensor,
];

/**
 * Like Rex, lets a pane be dragged by its title to move it beside another pane or into a new dashboard.
 * The only pane can still be dropped on the sidebar to move its dashboard.
 * Attach `dragRef` to the title and `dropRef` to the pane.
 */
export function usePaneDrag(dashboardId: string, pane: Pane) {
	const { ref: dragRef, isDragging } = useDraggable<PaneDragData>({
		id: `pane-${pane.id}`,
		type: paneDragType,
		sensors,
		data: { dashboardId, paneId: pane.id, widgetType: pane.widget?.type },
	});
	const { ref: dropRef, isDropTarget } = useDroppable<PaneDropData>({
		id: `pane-drop-${pane.id}`,
		accept: (source) => source.type === paneDragType && source.data['paneId'] !== pane.id,
		data: { kind: 'pane', paneId: pane.id },
	});
	return { dragRef, isDragging, dropRef, isDropTarget };
}

/** The side of `rect` nearest to `point`, where a pane dropped there goes */
export function nearestSide(rect: DOMRect, point: { x: number; y: number }): PaneSide {
	const x = (point.x - rect.left) / rect.width;
	const y = (point.y - rect.top) / rect.height;
	const distances: [PaneSide, number][] = [
		['left', x],
		['right', 1 - x],
		['top', y],
		['bottom', 1 - y],
	];
	return distances.reduce((nearest, other) => (other[1] < nearest[1] ? other : nearest))[0];
}
