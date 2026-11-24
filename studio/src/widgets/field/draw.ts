import { getStrokePoints } from 'perfect-freehand';
import { type PointerEvent, useMemo, useRef, useState } from 'react';
import type { FieldPoint, MeasureTool } from '@/widgets/field/geometry';

export type FieldTool = MeasureTool | 'draw';
export type DrawPointAt = (event: Pick<PointerEvent, 'clientX' | 'clientY'>) => FieldPoint | undefined;

/** One temporary freehand stroke, in blue-wall field coordinates in either view. */
export function useDraw() {
	const [samples, setSamples] = useState<readonly FieldPoint[]>([]);
	const pointer = useRef<number>(undefined);
	const points = useMemo(() => {
		if (samples.length < 2) {
			return [];
		}
		// Keep even short marks at high zoom. Pass the actual last point through so the tip stays under the pointer.
		return getStrokePoints(
			samples.map(({ x, y }) => [x, y]),
			{ size: 0, streamline: 0.65, last: true },
		).map(({ point: [x, y] }) => ({ x, y }));
	}, [samples]);

	const clear = () => {
		pointer.current = undefined;
		setSamples([]);
	};
	const extend = (next: (FieldPoint | undefined)[]) => {
		setSamples((current) => {
			let last = current.at(-1);
			const added = next.filter((point): point is FieldPoint => {
				if (!point || (last?.x === point.x && last.y === point.y)) {
					return false;
				}
				last = point;
				return true;
			});
			return added.length === 0 ? current : [...current, ...added];
		});
	};

	return {
		points,
		clear,
		start: (event: PointerEvent, point: FieldPoint | undefined) => {
			if (point && event.button === 0 && event.isPrimary && pointer.current === undefined) {
				event.currentTarget.setPointerCapture(event.pointerId);
				pointer.current = event.pointerId;
				setSamples([point]);
			}
		},
		isDrawing: (event: PointerEvent) => pointer.current === event.pointerId,
		move: (event: PointerEvent, pointAt: DrawPointAt, point: FieldPoint | undefined) => {
			const batch = event.nativeEvent.getCoalescedEvents?.();
			extend(batch?.length ? batch.map((sample) => pointAt(sample)) : [point]);
		},
		finish: (event: PointerEvent, point: FieldPoint | undefined) => {
			if (pointer.current === event.pointerId) {
				pointer.current = undefined;
				extend([point]);
			}
		},
		cancel: (event: PointerEvent) => {
			if (pointer.current === event.pointerId) {
				clear();
			}
		},
	};
}
