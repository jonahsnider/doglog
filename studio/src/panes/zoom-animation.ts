import { animate } from 'motion/mini';
import { type RefObject, useLayoutEffect, useState } from 'react';
import { findPane, type PaneNode } from '@/panes/layout';
import { easing, useMotionTransition } from '@/lib/motion';

// Panes leaving are quicker and accelerate
const zoomInTransition = { duration: 0.2, ease: easing.in };
const zoomOutTransition = { duration: 0.25, ease: easing.inOut };

/** A pane zooming in to fill the dashboard, or out as the others are restored */
export type Zoom = { paneId: string; zoomingIn: boolean };

/**
 * Zooming a pane slides the other panes off the dashboard, away from it, and restoring them slides them back. Panes move
 * by where they are rather than how they're split, so all the panes left of the zoomed pane move together.
 *
 * Returns the zoom while it plays. Meanwhile the panes are laid out as if nothing is zoomed, and `index.css` lets them
 * move outside their splits. When zooming in, the zoomed pane already fills the dashboard beneath the others.
 */
export function useZoomAnimation(
	container: RefObject<HTMLElement | null>,
	layout: PaneNode,
	zoomedPaneId: string | undefined,
): Zoom | undefined {
	const zoomIn = useMotionTransition(zoomInTransition);
	const zoomOut = useMotionTransition(zoomOutTransition);
	const [previous, setPrevious] = useState(zoomedPaneId);
	const [zoom, setZoom] = useState<Zoom>();
	if (previous !== zoomedPaneId) {
		setPrevious(zoomedPaneId);
		const paneId = zoomedPaneId ?? previous;
		// A closed zoomed pane has nothing to slide back beside
		setZoom(
			zoomIn.duration === 0 || paneId === undefined || !findPane(layout, paneId)
				? undefined
				: { paneId, zoomingIn: zoomedPaneId !== undefined },
		);
	}

	useLayoutEffect(() => {
		const element = container.current;
		const zoomed = zoom && element?.querySelector<HTMLElement>(`[data-pane-id="${CSS.escape(zoom.paneId)}"]`);
		// The zoomed pane already fills the dashboard when zooming in, but its panel is still where it was
		const slot = zoomed?.closest('[data-panel]');
		if (!element || !zoom || !zoomed || !slot) {
			return undefined;
		}

		const bounds = element.getBoundingClientRect();
		const target = slot.getBoundingClientRect();
		const panes = [...element.querySelectorAll<HTMLElement>('[data-pane-id]')].filter((pane) => pane !== zoomed);
		const offsets = panes.map((pane) => {
			const rect = pane.getBoundingClientRect();
			// Panes beside the zoomed pane move as far as its edge is from the dashboard's, within a pixel of rounding
			const x =
				rect.right <= target.left + 1
					? bounds.left - target.left
					: rect.left >= target.right - 1
						? bounds.right - target.right
						: 0;
			const y =
				rect.bottom <= target.top + 1
					? bounds.top - target.top
					: rect.top >= target.bottom - 1
						? bounds.bottom - target.bottom
						: 0;
			return `translate(${x}px, ${y}px)`;
		});

		const { duration, ease } = zoom.zoomingIn ? zoomIn : zoomOut;
		const animations = panes.map((pane, index) => {
			const away = offsets[index] ?? 'none';
			return animate(pane, { transform: zoom.zoomingIn ? ['none', away] : [away, 'none'] }, { duration, ease });
		});
		let stopped = false;
		void Promise.all(animations).then(() => {
			if (!stopped) {
				setZoom(undefined);
			}
			return undefined;
		});

		return () => {
			stopped = true;
			for (const animation of animations) {
				animation.cancel();
			}
		};
	}, [container, zoom, zoomIn, zoomOut]);

	return zoom;
}
