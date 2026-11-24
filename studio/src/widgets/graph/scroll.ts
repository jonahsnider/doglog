// Scrolling to zoom and pan, shared by widgets that show the graphs' time range
import { getViewRange, panTime, zoomTime } from '@/widgets/graph/view';

const gesturePauseMs = 200;
/** How much of a scroll gesture's earlier movement counts toward its direction with each event, ex. 0.7 keeps about the last 100 ms */
const directionMemory = 0.7;

/** React's wheel listeners are passive, so they can't stop the pane from scrolling or the page from zooming */
export const wheelListenerOptions = { passive: false };

/** Recent scroll movement, see `scrollPans()` */
export type Gesture = { x: number; y: number; at: number };

/** Pixels per wheel delta, which some browsers and mice send in lines or pages */
function wheelUnit(event: WheelEvent, pageHeight: number): number {
	return event.deltaMode === WheelEvent.DOM_DELTA_LINE
		? 16
		: event.deltaMode === WheelEvent.DOM_DELTA_PAGE
			? pageHeight
			: 1;
}

/**
 * Whether a scroll pans (sideways) or zooms (vertically or pinching), going by the direction of the last few events.
 * Trackpad swipes are rarely exactly sideways or vertical, so one stray event doesn't switch, but turning the swipe does.
 */
function scrollPans(event: WheelEvent, gesture: { current: Gesture | undefined }): boolean {
	const previous = gesture.current;
	const fresh = !previous || event.timeStamp - previous.at > gesturePauseMs;
	const x = (fresh ? 0 : previous.x * directionMemory) + Math.abs(event.deltaX);
	const y = (fresh ? 0 : previous.y * directionMemory) + Math.abs(event.deltaY);
	gesture.current = { x, y, at: event.timeStamp };
	return x > y && !event.ctrlKey;
}

/** How far a sideways scroll moves, as a fraction of `rect`'s width */
function panFraction(event: WheelEvent, rect: DOMRect): number {
	return (event.deltaX * wheelUnit(event, rect.height)) / rect.width;
}

/** How much a vertical scroll or pinch zooms by, below 1 zooms in */
function zoomFactor(event: WheelEvent, rect: DOMRect): number {
	// Capped like UI SDK's canvas viewport, so a mouse wheel's big steps don't jump
	const delta = Math.min(Math.max(event.deltaY * wheelUnit(event, rect.height), -50), 50);
	// Pinches arrive as wheel events with Ctrl held and much smaller deltas
	return Math.exp(delta * (event.ctrlKey ? 0.01 : 0.002));
}

/** Zooms the time graphs show toward the pointer, or pans it, where `area` spans that time */
export function scrollTime(event: WheelEvent, area: DOMRect, gesture: { current: Gesture | undefined }): void {
	const view = getViewRange();
	if (!view) {
		return;
	}
	if (scrollPans(event, gesture)) {
		panTime(view, panFraction(event, area) * (view.end - view.start));
	} else if (event.deltaY !== 0 && event.clientX >= area.left && event.clientX <= area.right) {
		const anchor = view.start + ((event.clientX - area.left) / area.width) * (view.end - view.start);
		zoomTime(anchor, zoomFactor(event, area));
	}
}
