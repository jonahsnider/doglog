// Zooming, panning, hovering, and seeking with the mouse, trackpad, or touch
import { useHotkey } from '@tanstack/react-hotkeys';
import { type PointerEvent, type RefObject, useEffect, useRef, useState } from 'react';
import { getCursorTime, seek } from '@/timeline/timeline';
import type { GraphPlot } from '@/widgets/graph/use-graph-drawing';
import { setHoverTime } from '@/timeline/hover';
import { getViewRange, panTime, resetView, zoomTime } from '@/widgets/graph/view';
import type { TimeRange } from '@/data/data-store';

/** Wheel events further apart than this start a new gesture */
const gesturePauseMs = 200;
/** How much of a scroll gesture's earlier movement counts toward its direction with each event, ex. 0.7 keeps about the last 100 ms */
const directionMemory = 0.7;

/** Pixels per wheel delta, which some browsers and mice send in lines or pages */
function wheelUnit(event: WheelEvent, pageHeight: number): number {
	return event.deltaMode === WheelEvent.DOM_DELTA_LINE
		? 16
		: event.deltaMode === WheelEvent.DOM_DELTA_PAGE
			? pageHeight
			: 1;
}

/** Pointer moves shorter than this are clicks */
const dragThreshold = 3;

/** A press that's a click until it moves, then selects a range to measure, or pans with Shift held */
type Drag =
	| { kind: 'press'; x: number; time: number; view: TimeRange; shift: boolean }
	| { kind: 'pan'; x: number; view: TimeRange }
	| { kind: 'select'; from: number }
	| { kind: 'y'; axis: 'y' | 'y2'; y: number; range: [number, number] };

/** Events from portals, ex. a band label's menu, bubble through React to the graph but aren't in it */
function isInGraph(event: PointerEvent): boolean {
	return event.target instanceof Node && event.currentTarget.contains(event.target);
}

/** Where the pointer is, `x` px into the area between the y-axes that's `width` px wide */
/** `flip` puts the tooltip left of the pointer */
export type PointerAt = { x: number; width: number; flip: boolean };

/**
 * Where the pointer is over the bands, for their tooltip. `pixel` is the time (µs) a pixel spans, and `top` is where the
 * bands start in the graph.
 */
export type BandHover = PointerAt & { row: number; time: number; pixel: number; top: number };

/** Hovering or clicking this close to the cursor snaps to it, so its values are easy to keep in view */
const snapPixels = 6;
/** The tooltip only switches sides of the pointer once it's this far past the middle, so it doesn't flip back and forth */
const flipDeadband = 40;

/** Whether the tooltip goes left of the pointer, `x` px into `width`, staying on the side it was on near the middle */
function flipsAt(x: number, width: number, flipped: boolean | undefined): boolean {
	const deadband = flipped === undefined ? 0 : Math.min(flipDeadband, width / 8);
	return x > width / 2 + (flipped === true ? -deadband : deadband);
}

export function useGraphPointer(
	body: RefObject<HTMLDivElement | null>,
	area: RefObject<HTMLDivElement | null>,
	bands: RefObject<HTMLCanvasElement | null>,
	graph: RefObject<GraphPlot>,
	bandRowHeight: number,
) {
	const drag = useRef<Drag>(undefined);
	/** How far the current scroll gesture has recently moved sideways and vertically, and when its last event came */
	const gesture = useRef<{ x: number; y: number; at: number }>(undefined);
	const [hovered, setHovered] = useState(false);
	const [bandHover, setBandHover] = useState<BandHover>();
	const [pointerAt, setPointerAt] = useState<PointerAt>();
	/** The time range selected by dragging, to measure it */
	const [selection, setSelection] = useState<TimeRange>();
	/** Clicking keeps the tooltip shown at the cursor, the area between the y-axes was `width` px wide then */
	const [pinned, setPinned] = useState<{ width: number }>();
	useHotkey(
		'Escape',
		() => {
			setSelection(undefined);
			setPinned(undefined);
		},
		{ enabled: selection !== undefined || pinned !== undefined, ignoreInputs: false, conflictBehavior: 'allow' },
	);

	const reset = () => {
		resetView();
		graph.current.setManual(undefined);
	};
	useHotkey('R', reset, { enabled: hovered, conflictBehavior: 'allow' });

	/** Time under `clientX`, `undefined` outside the area between the y-axes */
	const timeAt = (clientX: number): number | undefined => {
		const view = getViewRange();
		const rect = area.current?.getBoundingClientRect();
		if (!view || !rect || clientX < rect.left || clientX > rect.right) {
			return undefined;
		}
		return view.start + ((clientX - rect.left) / rect.width) * (view.end - view.start);
	};

	/** The y-axis under the pointer, over its labels or anywhere in the plot while holding Shift */
	const yAxisAt = (clientX: number, clientY: number, shift: boolean): ('y' | 'y2')[] => {
		const plot = graph.current.plot;
		const rect = plot?.root.getBoundingClientRect();
		const areaRect = area.current?.getBoundingClientRect();
		if (!plot || !rect || !areaRect || clientY < rect.top || clientY > rect.bottom) {
			return [];
		}
		const axes = Object.keys(plot.scales).filter((key): key is 'y' | 'y2' => key === 'y' || key === 'y2');
		if (clientX < areaRect.left) {
			return ['y'];
		}
		if (clientX > areaRect.right) {
			return axes.includes('y2') ? ['y2'] : [];
		}
		return shift ? axes : [];
	};

	const zoomY = (axes: readonly ('y' | 'y2')[], clientY: number, factor: number) => {
		const plot = graph.current.plot!;
		for (const axis of axes) {
			const { min, max } = plot.scales[axis]!;
			if (min === undefined || max === undefined || min === null || max === null) {
				continue;
			}
			const anchor = plot.posToVal(clientY - plot.over.getBoundingClientRect().top, axis);
			graph.current.setManual(axis, [anchor - (anchor - min) * factor, anchor + (max - anchor) * factor]);
		}
	};

	useEffect(() => {
		const element = body.current!;
		// React's wheel listeners are passive, so they can't stop the pane from scrolling or the page from zooming
		const onWheel = (event: WheelEvent) => {
			event.preventDefault();
			const delta = event.deltaY === 0 ? event.deltaX : event.deltaY;
			const axes = yAxisAt(event.clientX, event.clientY, event.shiftKey);
			// Pinches arrive as wheel events with Ctrl held and much smaller deltas
			const factor = Math.exp(delta * (event.ctrlKey ? 0.01 : 0.002));
			if (axes.length > 0) {
				zoomY(axes, event.clientY, factor);
				return;
			}
			const view = getViewRange();
			const time = timeAt(event.clientX);
			if (!view) {
				return;
			}
			// Sideways scrolling pans and vertical scrolling zooms, going by the direction of the last few events. Trackpad
			// swipes are rarely exactly sideways or vertical, so one stray event doesn't switch, but turning the swipe does.
			const previous = gesture.current;
			const fresh = !previous || event.timeStamp - previous.at > gesturePauseMs;
			const x = (fresh ? 0 : previous.x * directionMemory) + Math.abs(event.deltaX);
			const y = (fresh ? 0 : previous.y * directionMemory) + Math.abs(event.deltaY);
			gesture.current = { x, y, at: event.timeStamp };
			const rect = area.current!.getBoundingClientRect();
			const unit = wheelUnit(event, rect.height);
			if (x > y && !event.ctrlKey) {
				panTime(view, ((event.deltaX * unit) / rect.width) * (view.end - view.start));
			} else if (time !== undefined && event.deltaY !== 0) {
				// Capped like UI SDK's canvas viewport, so a mouse wheel's big steps don't jump
				const zoomDelta = Math.min(Math.max(event.deltaY * unit, -50), 50);
				zoomTime(time, Math.exp(zoomDelta * (event.ctrlKey ? 0.01 : 0.002)));
			}
		};
		element.addEventListener('wheel', onWheel, { passive: false });
		return () => element.removeEventListener('wheel', onWheel);
	});

	/** `time`, or the cursor's when it's within a few pixels */
	const snapToCursor = (time: number): number => {
		const cursor = getCursorTime();
		const view = getViewRange();
		const width = area.current!.getBoundingClientRect().width;
		const near =
			view !== undefined && Math.abs(time - (cursor ?? Infinity)) <= (snapPixels / width) * (view.end - view.start);
		return near ? cursor! : time;
	};

	const hoverAt = (event: PointerEvent) => {
		const time = timeAt(event.clientX);
		setHoverTime(time === undefined ? undefined : snapToCursor(time));
		const areaRect = area.current!.getBoundingClientRect();
		const x = event.clientX - areaRect.left;
		setPointerAt((previous) =>
			time === undefined ? undefined : { x, width: areaRect.width, flip: flipsAt(x, areaRect.width, previous?.flip) },
		);
		const canvas = bands.current?.getBoundingClientRect();
		const view = getViewRange();
		setBandHover(
			canvas !== undefined &&
				view !== undefined &&
				time !== undefined &&
				event.clientY >= canvas.top &&
				event.clientY <= canvas.bottom
				? {
						row: Math.floor((event.clientY - canvas.top) / bandRowHeight),
						x: event.clientX - canvas.left,
						width: canvas.width,
						flip: flipsAt(event.clientX - canvas.left, canvas.width, bandHover?.flip),
						time,
						pixel: (view.end - view.start) / canvas.width,
						top: canvas.top - body.current!.getBoundingClientRect().top,
					}
				: undefined,
		);
	};

	const areaLeft = () => area.current!.getBoundingClientRect().left;
	const areaRight = () => area.current!.getBoundingClientRect().right;

	/** A click without dragging clears the selected range or the pinned tooltip, or seeks and pins the tooltip there */
	const click = (time: number) => {
		if (selection) {
			setSelection(undefined);
		} else if (pinned) {
			setPinned(undefined);
		} else {
			seek(time);
			setPinned({ width: area.current!.getBoundingClientRect().width });
		}
	};

	return {
		bandHover,
		pointerAt,
		selection,
		pinned,
		handlers: {
			onPointerDown: (event: PointerEvent) => {
				// Labels are dragged to reorder or move entries
				if (
					event.button !== 0 ||
					!isInGraph(event) ||
					(event.target instanceof Element && event.target.closest('[data-graph-label]'))
				) {
					return;
				}
				const [axis] = yAxisAt(event.clientX, event.clientY, false);
				const plot = graph.current.plot;
				const view = getViewRange();
				const time = timeAt(event.clientX);
				if (axis && plot) {
					const { min, max } = plot.scales[axis]!;
					drag.current = { kind: 'y', axis, y: event.clientY, range: [min ?? 0, max ?? 1] };
				} else if (view && time !== undefined) {
					drag.current = { kind: 'press', x: event.clientX, time, view, shift: event.shiftKey };
				} else {
					return;
				}
				event.currentTarget.setPointerCapture(event.pointerId);
			},
			onPointerMove: (event: PointerEvent) => {
				const current = drag.current;
				if (current?.kind === 'press' && Math.abs(event.clientX - current.x) > dragThreshold) {
					drag.current = current.shift
						? { kind: 'pan', x: current.x, view: current.view }
						: { kind: 'select', from: current.time };
				}
				const dragging = drag.current;
				if (dragging?.kind === 'pan') {
					const width = area.current!.getBoundingClientRect().width;
					const dx = event.clientX - dragging.x;
					panTime(dragging.view, (-dx / width) * (dragging.view.end - dragging.view.start));
				} else if (dragging?.kind === 'select') {
					const time = timeAt(Math.min(Math.max(event.clientX, areaLeft()), areaRight()));
					if (time !== undefined) {
						setSelection({ start: Math.min(dragging.from, time), end: Math.max(dragging.from, time) });
					}
				} else if (dragging?.kind === 'y') {
					const plot = graph.current.plot!;
					const [min, max] = dragging.range;
					const offset = ((event.clientY - dragging.y) / plot.over.clientHeight) * (max - min);
					graph.current.setManual(dragging.axis, [min + offset, max + offset]);
				}
				if (isInGraph(event)) {
					hoverAt(event);
				}
			},
			onPointerUp: () => {
				const current = drag.current;
				drag.current = undefined;
				if (current?.kind === 'press') {
					click(snapToCursor(current.time));
				}
			},
			onPointerCancel: () => {
				drag.current = undefined;
			},
			onPointerEnter: () => setHovered(true),
			onPointerLeave: () => {
				setHovered(false);
				setHoverTime(undefined);
				setBandHover(undefined);
				setPointerAt(undefined);
			},
		},
	};
}
