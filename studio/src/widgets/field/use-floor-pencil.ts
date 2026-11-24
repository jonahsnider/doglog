import { useHotkey } from '@tanstack/react-hotkeys';
import { type DOMAttributes, type RefObject, useState } from 'react';
import type { FloorProjection } from '@/three/field-scene';
import type { FieldPoint } from '@/widgets/field/geometry';
import { usePencil } from '@/widgets/field/pencil';

export function useFloorPencil(
	projectFloor: RefObject<FloorProjection | null>,
	onMove: (point: FieldPoint | undefined) => void,
	onPointerDown: DOMAttributes<HTMLDivElement>['onPointerDownCapture'],
) {
	const [hovered, setHovered] = useState(false);
	const [active, setActive] = useState(false);
	const pencil = usePencil();
	const toggle = () => {
		setActive(!active);
		pencil.clear();
	};
	const whileHovered = { enabled: hovered, conflictBehavior: 'allow' } as const;
	useHotkey('P', toggle, whileHovered);
	useHotkey('Escape', toggle, { ...whileHovered, enabled: hovered && active });

	const handlers: DOMAttributes<HTMLDivElement> = {
		onPointerEnter: () => setHovered(true),
		onPointerLeave: () => {
			setHovered(false);
			onMove(undefined);
		},
		onPointerDownCapture: (event) => {
			onPointerDown?.(event);
			if (active && event.button === 0) {
				// Take the drag before the scene's camera controls can start orbiting.
				event.stopPropagation();
				pencil.start(event, projectFloor.current?.()(event));
			}
		},
		onDoubleClickCapture: (event) => {
			if (active) {
				event.stopPropagation();
			}
		},
		onPointerMove: (event) => {
			if (pencil.isDrawing(event)) {
				const pointAt = projectFloor.current?.();
				if (pointAt) {
					const point = pointAt(event);
					pencil.move(event, pointAt, point);
					onMove(point);
				}
			}
		},
		onPointerUp: (event) => {
			if (pencil.isDrawing(event)) {
				pencil.finish(event, projectFloor.current?.()(event));
			}
		},
		onPointerCancel: pencil.cancel,
		onLostPointerCapture: pencil.cancel,
	};
	return { tool: active ? ('pencil' as const) : undefined, points: pencil.points, toggle, handlers };
}
