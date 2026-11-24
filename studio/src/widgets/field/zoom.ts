import { type PointerEvent, type RefObject, useEffect, useRef, useState } from 'react';
import { useEventListener } from 'usehooks-ts';

/** SVG user-space rectangle, the view of the whole field */
export type Bounds = { x: number; y: number; width: number; height: number };

/** Content is scaled by `scale` then moved by `x` and `y`, in SVG user units */
export type Zoom = { scale: number; x: number; y: number };

const noZoom: Zoom = { scale: 1, x: 0, y: 0 };
const maxScale = 8;
const activeMs = 800;
const wheelListenerOptions = { passive: false };

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

/**
 * Offset along one axis that keeps content from `start` to `end`, scaled by `scale`, in view. Content bigger than the
 * view must cover it, and smaller content must stay inside it while covering where it's shown unzoomed, so it can't be
 * panned out of view and grows into the view's spare room as it zooms in.
 */
function clampOffset(offset: number, scale: number, start: number, end: number, viewStart: number, viewEnd: number) {
	if ((end - start) * scale >= viewEnd - viewStart) {
		return clamp(offset, viewEnd - end * scale, viewStart - start * scale);
	}
	return clamp(
		offset,
		Math.max(viewStart - start * scale, end - end * scale),
		Math.min(start - start * scale, viewEnd - end * scale),
	);
}

/** Limits the scale and keeps the zoomed `bounds` in `view`, see `clampOffset()` */
function clampZoom(bounds: Bounds, view: Bounds, { scale, x, y }: Zoom): Zoom {
	const clampedScale = clamp(scale, 1, maxScale);
	return {
		scale: clampedScale,
		x: clampOffset(x, clampedScale, bounds.x, bounds.x + bounds.width, view.x, view.x + view.width),
		y: clampOffset(y, clampedScale, bounds.y, bounds.y + bounds.height, view.y, view.y + view.height),
	};
}

function markActive(timer: RefObject<ReturnType<typeof setTimeout> | undefined>, setActive: (active: boolean) => void) {
	setActive(true);
	clearTimeout(timer.current);
	timer.current = setTimeout(() => setActive(false), activeMs);
}

/** SVG user-space point under a client position */
function toUser(svg: SVGSVGElement, clientX: number, clientY: number): DOMPoint {
	return new DOMPoint(clientX, clientY).matrixTransform(svg.getScreenCTM()!.inverse());
}

/**
 * Zoom to the pointer with the scroll wheel or a pinch, pan by dragging, and reset by double-clicking. `view` is the
 * SVG's whole view box, when it shows more than `bounds` around them.
 */
export function useFieldZoom(bounds: Bounds, view = bounds) {
	const svgRef = useRef<SVGSVGElement>(null!);
	const [storedZoom, setZoom] = useState(noZoom);
	// The view changes size with the widget, so an offset that was in view may not be anymore
	const zoom = clampZoom(bounds, view, storedZoom);
	const [zoomBounds, setZoomBounds] = useState(bounds);
	const [active, setActive] = useState(false);
	const activeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
	const dragFrom = useRef<{ x: number; y: number } | undefined>(undefined);

	// Offsets from a landscape view don't describe the same region in portrait, or vice versa.
	if (zoomBounds !== bounds) {
		setZoomBounds(bounds);
		setZoom(noZoom);
	}

	const update = (next: (current: Zoom) => Zoom) => {
		setZoom((current) => clampZoom(bounds, view, next(clampZoom(bounds, view, current))));
		markActive(activeTimer, setActive);
	};

	useEffect(() => () => clearTimeout(activeTimer.current), []);

	// React's wheel listeners are passive, so they can't stop the pane from scrolling or the page from zooming
	useEventListener(
		'wheel',
		(event) => {
			event.preventDefault();
			const anchor = toUser(svgRef.current, event.clientX, event.clientY);
			// Pinches send small deltas with `ctrlKey`, mouse wheels send large deltas, sometimes in lines
			const sensitivity = (event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 0.05 : 0.002) * (event.ctrlKey ? 5 : 1);
			const factor = Math.exp(-event.deltaY * sensitivity);
			setZoom((stored) => {
				const current = clampZoom(bounds, view, stored);
				const scale = clamp(current.scale * factor, 1, maxScale);
				const ratio = scale / current.scale;
				// Keep the point under the pointer in place
				return clampZoom(bounds, view, {
					scale,
					x: anchor.x - (anchor.x - current.x) * ratio,
					y: anchor.y - (anchor.y - current.y) * ratio,
				});
			});
			markActive(activeTimer, setActive);
		},
		svgRef,
		wheelListenerOptions,
	);

	return {
		svgRef,
		zoom,
		active,
		transform: `translate(${zoom.x} ${zoom.y}) scale(${zoom.scale})`,
		/** Snapshot the transform once for all the pointer samples in an event. */
		contentPointAt: () => {
			const inverse = svgRef.current.getScreenCTM()!.inverse();
			return ({ clientX, clientY }: Pick<PointerEvent, 'clientX' | 'clientY'>) => {
				const point = new DOMPoint(clientX, clientY).matrixTransform(inverse);
				return { x: (point.x - zoom.x) / zoom.scale, y: (point.y - zoom.y) / zoom.scale };
			};
		},
		startPan: (event: PointerEvent) => {
			event.currentTarget.setPointerCapture(event.pointerId);
			dragFrom.current = { x: event.clientX, y: event.clientY };
		},
		movePan: (event: PointerEvent): boolean => {
			if (dragFrom.current === undefined) {
				return false;
			}
			const unitsPerPixel = 1 / svgRef.current.getScreenCTM()!.a;
			const dx = (event.clientX - dragFrom.current.x) * unitsPerPixel;
			const dy = (event.clientY - dragFrom.current.y) * unitsPerPixel;
			dragFrom.current = { x: event.clientX, y: event.clientY };
			update((current) => ({ ...current, x: current.x + dx, y: current.y + dy }));
			return true;
		},
		endPan: () => {
			dragFrom.current = undefined;
		},
		reset: () => setZoom(noZoom),
	};
}
