// The time range every graph shows, and the time hovered in any of them. Not saved: zooming is part of looking at data.
import { useSelector } from '@tanstack/react-store';
import { useEffect, useReducer } from 'react';
import { createAtom } from '@tanstack/store';
import type { DataSet } from '@/data/data-set';
import { getActiveData, getTimeRange, subscribeData, type TimeRange } from '@/data/data-store';
import { subscribeHover } from '@/timeline/hover';
import { getTimeline, stopFollowing, subscribeTimeline } from '@/timeline/timeline';

/** Live sources show the newest 30 s until zoomed */
const defaultLiveWidth = 30_000_000;
/** Zooming in stops at 1 ms */
const minWidth = 1000;

type View = {
	/** The range picked by zooming or panning, the default range when `undefined` */
	range: TimeRange | undefined;
	/** How much of a followed live source is shown */
	liveWidth: number;
	/** The data the range was picked in, other data shows its default range */
	data: DataSet | undefined;
	/** How much time was shown before switching to a log, it's shown around the cursor until a range is picked */
	logWidth: number | undefined;
};

const viewStore = createAtom<View>({
	range: undefined,
	liveWidth: defaultLiveWidth,
	data: undefined,
	logWidth: undefined,
});

function clampRange(start: number, end: number, source: TimeRange): TimeRange {
	const sourceWidth = Math.max(source.end - source.start, minWidth);
	const width = Math.min(Math.max(end - start, minWidth), sourceWidth);
	const clampedStart = Math.min(Math.max(start, source.start), source.start + sourceWidth - width);
	return { start: clampedStart, end: clampedStart + width };
}

/** The time range graphs show, `undefined` until the source has data */
export function getViewRange(): TimeRange | undefined {
	const source = getTimeRange();
	if (source === undefined) {
		return undefined;
	}

	const { range, liveWidth, data, logWidth } = viewStore.get();
	const picked = data === getActiveData() ? range : undefined;
	const { live, playback, time } = getTimeline();
	if (live && (playback === 'following' || picked === undefined)) {
		return clampRange(source.end - liveWidth, source.end, source);
	}
	if (picked) {
		return clampRange(picked.start, picked.end, source);
	}
	if (logWidth !== undefined && time !== undefined) {
		return clampRange(time - logWidth / 2, time + logWidth / 2, source);
	}
	return clampRange(source.start, source.end, source);
}

function setRange(range: TimeRange): void {
	viewStore.set((view) => ({ ...view, range, data: getActiveData() }));
}

/** Keep showing as much time when switching between the log and live session, call it before switching */
export function keepViewWidth(): void {
	const view = getViewRange();
	if (view !== undefined) {
		const width = view.end - view.start;
		viewStore.set((current) => ({ ...current, range: undefined, data: undefined, liveWidth: width, logWidth: width }));
	}
}

/** Show all of the next log, ex. a log that was just opened */
export function showWholeSource(): void {
	viewStore.set((view) => ({ ...view, range: undefined, data: undefined, logWidth: undefined }));
}

/** Zoom the time range by `factor` (below 1 zooms in) around `anchor`, a time in the range */
export function zoomTime(anchor: number, factor: number): void {
	const view = getViewRange();
	const source = getTimeRange();
	if (view === undefined || source === undefined) {
		return;
	}

	const width = Math.min(Math.max((view.end - view.start) * factor, minWidth), source.end - source.start);
	const { live, playback } = getTimeline();
	if (live && playback === 'following') {
		// The newest data stays at the right edge
		viewStore.set((current) => ({ ...current, liveWidth: width }));
		return;
	}
	const start = anchor - ((anchor - view.start) / (view.end - view.start)) * width;
	setRange(clampRange(start, start + width, source));
}

/** Move the time range by `offset` (µs) from `from`, the range when panning started. Panning back stops following. */
export function panTime(from: TimeRange, offset: number): void {
	const source = getTimeRange();
	if (source === undefined) {
		return;
	}
	if (offset < 0) {
		stopFollowing();
	}
	setRange(clampRange(from.start + offset, from.end + offset, source));
}

export function resetView(): void {
	viewStore.set({ range: undefined, liveWidth: defaultLiveWidth, data: undefined, logWidth: undefined });
}

/** Calls `listener` when the time range or the hovered time change, read them with `getViewRange()` and `getHoverTime()` */
export function subscribeView(listener: () => void): () => void {
	const view = viewStore.subscribe(() => listener());
	const unsubscribeHover = subscribeHover(listener);
	return () => {
		view.unsubscribe();
		unsubscribeHover();
	};
}

/** How many graphs are shown, the timeline bar marks their time range while there are any */
const shownGraphsStore = createAtom(0);

export function useGraphShown(): void {
	useEffect(() => {
		shownGraphsStore.set((count) => count + 1);
		return () => shownGraphsStore.set((count) => count - 1);
	}, []);
}

/** The time range graphs show, `undefined` without any graphs or when they show the whole source */
export function useZoomedRange(): TimeRange | undefined {
	const shown = useSelector(shownGraphsStore) > 0;
	const view = useViewRange();
	const source = getTimeRange();
	return shown && view && source && (view.start > source.start || view.end < source.end) ? view : undefined;
}

/** The time range graphs show, re-rendering when it changes, including as it follows live data */
export function useViewRange(): TimeRange | undefined {
	const [, update] = useReducer((count: number) => count + 1, 0);
	useEffect(() => {
		const unsubscribeView = subscribeView(update);
		const unsubscribeData = subscribeData(update);
		const unsubscribeTimeline = subscribeTimeline(update);
		return () => {
			unsubscribeView();
			unsubscribeData();
			unsubscribeTimeline();
		};
	}, []);
	return getViewRange();
}
