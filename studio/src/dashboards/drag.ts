import { type Draggable, PointerActivationConstraints } from '@dnd-kit/dom';
import { KeyboardSensor, PointerSensor } from '@dnd-kit/react';

/** Drag type of dashboards in the sidebar */
export const dashboardDragType = 'dashboard';

export type DashboardDragData = { dashboardId: string; shared: boolean };

/** Data of a split zone, dropping a dashboard on it adds its panes to the open dashboard on that side */
export type SplitZoneData = { kind: 'split-zone'; dashboardId: string; side: 'left' | 'right' };

export function isDashboardDrag(source: Draggable | null | undefined): source is Draggable<DashboardDragData> {
	return source?.type === dashboardDragType;
}

export function isSplitZone(data: Record<string, unknown> | undefined): data is SplitZoneData {
	return data?.['kind'] === 'split-zone';
}

export const dashboardSensors = [
	// Only start dragging once the pointer moves, so clicking a dashboard still opens it
	PointerSensor.configure({ activationConstraints: [new PointerActivationConstraints.Distance({ value: 5 })] }),
	// Enter opens the focused dashboard, so only Space picks it up
	KeyboardSensor.configure({ keyboardCodes: { ...KeyboardSensor.defaults.keyboardCodes, start: ['Space'] } }),
];
