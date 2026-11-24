import { useHotkey } from '@tanstack/react-hotkeys';
import { type DOMAttributes, type RefObject, useState } from 'react';
import type { FloorProjection } from '@/three/field-scene';
import { useDraw } from '@/widgets/field/draw';
import type { FieldPoint } from '@/widgets/field/geometry';

export function useFloorDraw(
	projectFloor: RefObject<FloorProjection | null>,
	onMove: (point: FieldPoint | undefined) => void,
	onPointerDown: DOMAttributes<HTMLDivElement>['onPointerDownCapture'],
) {
	const [hovered, setHovered] = useState(false);
	const [active, setActive] = useState(false);
	const draw = useDraw();
	const toggle = () => {
		setActive(!active);
		draw.clear();
	};
	const whileHovered = { enabled: hovered, conflictBehavior: 'allow' } as const;
	useHotkey('D', toggle, whileHovered);
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
				draw.start(event, projectFloor.current?.()(event));
			}
		},
		onDoubleClickCapture: (event) => {
			if (active) {
				event.stopPropagation();
			}
		},
		onPointerMove: (event) => {
			if (draw.isDrawing(event)) {
				const pointAt = projectFloor.current?.();
				if (pointAt) {
					const point = pointAt(event);
					draw.move(event, pointAt, point);
					onMove(point);
				}
			}
		},
		onPointerUp: (event) => {
			if (draw.isDrawing(event)) {
				draw.finish(event, projectFloor.current?.()(event));
			}
		},
		onPointerCancel: draw.cancel,
		onLostPointerCapture: draw.cancel,
	};
	return { tool: active ? ('draw' as const) : undefined, points: draw.points, toggle, handlers };
}
