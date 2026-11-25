import { usePanGesture } from '@astryxdesign/core/hooks';
import { type RefObject, useEffect, useLayoutEffect, useRef } from 'react';
import { duration, easing, reducesMotion } from '@/lib/motion';

/** Release speed toward the edge, in px/s, that closes the panel however far it moved, the flick speed of iOS sheets */
const flickSpeed = 1008;

function findPanel(element: HTMLElement | null, panel: string | undefined): HTMLElement | null {
	return panel === undefined ? element : (element?.querySelector<HTMLElement>(panel) ?? null);
}

/**
 * Lets a touch swipe toward the edge a panel slid in from close it. The panel follows the finger without leaving that
 * edge, and slides back when it's let go less than halfway out without a flick. A mouse drag does nothing.
 *
 * The panel keeps its offset while it slides out, and drops it when it opens again.
 *
 * @param ref Where a swipe can start, the panel or an overlay holding it
 * @param options.panel Selects the panel in `ref`'s element, which is the panel without it
 */
export function useSwipeToClose(
	ref: RefObject<HTMLElement | null>,
	{ isOpen, side, onClose, panel }: { isOpen: boolean; side: 'start' | 'end'; onClose: () => void; panel?: string },
): void {
	const touch = useRef(false);
	const offset = useRef(0);

	// Pans don't say what drives them, so it's read from the press that starts one
	useEffect(() => {
		const onPointerDown = (event: PointerEvent) => {
			touch.current = event.pointerType !== 'mouse';
		};
		document.addEventListener('pointerdown', onPointerDown, { capture: true });
		return () => document.removeEventListener('pointerdown', onPointerDown, { capture: true });
	}, []);

	useLayoutEffect(() => {
		const element = findPanel(ref.current, panel);
		if (isOpen && element) {
			element.style.translate = '';
		}
	}, [isOpen, panel, ref]);

	usePanGesture(ref, {
		axis: 'x',
		onPan: ({ state, translation, velocity }) => {
			const element = findPanel(ref.current, panel);
			if (!element || !touch.current) {
				return;
			}

			const direction = side === 'start' ? -1 : 1;
			if (state === 'began' || state === 'changed') {
				offset.current = direction * Math.max(0, direction * translation.x);
				element.style.translate = `${offset.current}px 0`;
				return;
			}

			const speed = direction * velocity.x;
			const pastHalfway = Math.abs(offset.current) > element.offsetWidth / 2;
			if (state === 'ended' && (speed > flickSpeed || (pastHalfway && speed > -flickSpeed))) {
				onClose();
				return;
			}

			element.style.translate = '';
			if (offset.current !== 0 && !reducesMotion()) {
				element.animate([{ translate: `${offset.current}px 0` }, { translate: '0 0' }], {
					duration: duration.fast * 1000,
					easing: `cubic-bezier(${easing.move.join(', ')})`,
				});
			}
			offset.current = 0;
		},
	});
}
