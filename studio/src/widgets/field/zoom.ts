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

/** Limits the scale, and keeps the zoomed content covering `bounds` so it can't be panned out of view */
function clampZoom(bounds: Bounds, { scale, x, y }: Zoom): Zoom {
	const clampedScale = clamp(scale, 1, maxScale);
	const shrink = 1 - clampedScale;
	return {
		scale: clampedScale,
		x: clamp(x, (bounds.x + bounds.width) * shrink, bounds.x * shrink),
		y: clamp(y, (bounds.y + bounds.height) * shrink, bounds.y * shrink),
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

/** Zoom to the pointer with the scroll wheel or a pinch, pan by dragging, and reset by double-clicking */
export function useFieldZoom(bounds: Bounds) {
	const svgRef = useRef<SVGSVGElement>(null!);
	const [zoom, setZoom] = useState(noZoom);
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
		setZoom((current) => clampZoom(bounds, next(current)));
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
			setZoom((current) => {
				const scale = clamp(current.scale * factor, 1, maxScale);
				const ratio = scale / current.scale;
				// Keep the point under the pointer in place
				return clampZoom(bounds, {
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
		/** The zoomed content's point under a client position, in SVG user units */
		toContent: (clientX: number, clientY: number) => {
			const point = toUser(svgRef.current, clientX, clientY);
			return { x: (point.x - zoom.x) / zoom.scale, y: (point.y - zoom.y) / zoom.scale };
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
