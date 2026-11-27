import { type PointerEvent, useRef } from 'react';

const edgeInset = 16;
const swipeDistance = 48;
const tapSlop = 10;

/** Recognizes a touch swipe on blank app chrome, leaving taps on controls and system edge gestures alone. */
export function useSwipeToOpen(onSwipe?: (dx: number, startX: number) => void, onTap?: () => void) {
	const start = useRef<{ id: number; x: number; y: number } | undefined>(undefined);

	return {
		'data-sidebar-swipe': onSwipe ? '' : undefined,
		onPointerDown(event: PointerEvent<HTMLElement>) {
			start.current = undefined;
			if (
				(onSwipe || onTap) &&
				event.isPrimary &&
				event.pointerType !== 'mouse' &&
				event.target instanceof Element &&
				event.currentTarget.contains(event.target) &&
				!event.target.closest('a, button, input, [role="button"]')
			) {
				start.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
			}
		},
		onPointerCancel() {
			start.current = undefined;
		},
		onPointerUp(event: PointerEvent<HTMLElement>) {
			const press = start.current;
			start.current = undefined;
			if (!press || press.id !== event.pointerId) {
				return;
			}

			const dx = event.clientX - press.x;
			const dy = Math.abs(event.clientY - press.y);
			if (Math.hypot(dx, dy) < tapSlop) {
				onTap?.();
			} else if (
				event.pointerType === 'touch' &&
				press.x >= edgeInset &&
				press.x <= window.innerWidth - edgeInset &&
				Math.abs(dx) >= swipeDistance &&
				Math.abs(dx) > dy * 1.5
			) {
				onSwipe?.(dx, press.x);
			}
		},
	};
}
