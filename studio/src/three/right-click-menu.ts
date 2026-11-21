import { type MouseEvent, type PointerEvent, useRef } from 'react';

/** A right-click that moves fewer pixels than this opens the context menu instead of panning */
const clickSlop = 4;

/**
 * Lets right-dragging pan a 3D view while a right-click still opens the context menu. The browser's menu event is
 * stopped, since some systems send it when the button is pressed, and one is sent when the button is released
 * without dragging. Call the handlers from the view's.
 */
export function useRightClickMenu() {
	const start = useRef<{ x: number; y: number }>(undefined);
	/** The menu event sent for the right-click, which isn't stopped */
	const opening = useRef<Event>(undefined);
	return {
		onPointerDown: (event: PointerEvent) => {
			start.current = event.button === 2 ? { x: event.clientX, y: event.clientY } : undefined;
		},
		onPointerMove: (event: PointerEvent) => {
			if (start.current && Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) > clickSlop) {
				start.current = undefined;
			}
		},
		onPointerUp: (event: PointerEvent) => {
			if (event.button !== 2 || start.current === undefined) {
				return;
			}
			start.current = undefined;
			const { clientX, clientY, screenX, screenY } = event;
			opening.current = new MouseEvent('contextmenu', {
				bubbles: true,
				cancelable: true,
				clientX,
				clientY,
				screenX,
				screenY,
				button: 2,
			});
			event.target.dispatchEvent(opening.current);
		},
		onContextMenu: (event: MouseEvent) => {
			if (event.nativeEvent !== opening.current) {
				event.preventDefault();
				event.stopPropagation();
			}
		},
	};
}
