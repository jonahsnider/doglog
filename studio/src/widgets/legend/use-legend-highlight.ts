import { type PointerEvent, useEffect, useRef } from 'react';

/** How long an entry is hovered before it's highlighted, like Astryx's menu hover delay, so passing over doesn't flash */
const highlightDelayMs = 150;

/**
 * Highlights the legend entry a mouse rests on, for a widget to pick out its data from the rest. Moving to another entry
 * switches right away, and leaving the element the handlers are on, which holds the legends, clears it.
 */
export function useLegendHighlight(onHighlight: (bindingId: string | undefined) => void): {
	onPointerOver: (event: PointerEvent) => void;
	onPointerLeave: () => void;
} {
	const highlighted = useRef<string>(undefined);
	const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
	useEffect(() => () => clearTimeout(timer.current), []);
	const highlight = (bindingId: string | undefined) => {
		clearTimeout(timer.current);
		if (bindingId !== highlighted.current) {
			highlighted.current = bindingId;
			onHighlight(bindingId);
		}
	};
	return {
		onPointerOver: (event) => {
			if (event.pointerType !== 'mouse' || !(event.target instanceof Element)) {
				return;
			}
			const id = event.target.closest<HTMLElement>('[data-binding-legend] [data-binding-id]')?.dataset['bindingId'];
			clearTimeout(timer.current);
			if (id !== undefined && highlighted.current !== undefined) {
				highlight(id);
			} else if (id !== undefined) {
				timer.current = setTimeout(() => highlight(id), highlightDelayMs);
			}
		},
		onPointerLeave: () => highlight(undefined),
	};
}
