// oxlint-disable max-lines -- The timeline's state and the functions that change it are kept together
import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
import { createContext } from 'react';
import * as z from 'zod';
import { getTimeRange, subscribeData, type TimeRange } from '@/data/data-store';
import type { Source } from '@/data/source';
import { createPersistedAtom } from '@/lib/persisted-store';
import { type CompressedSpan, getActiveCompressedSpans, rateInSpan } from '@/timeline/events';
import { type PlaybackClock, timeFromVideo, videoClockAt } from '@/timeline/playback-clock';

export { formatRoughDuration, formatTime } from '@/timeline/format-time';

/** `following` keeps the cursor on the newest data, it's only used by live sources */
type Playback = 'paused' | 'playing' | 'following';

export type Timeline = {
	/** Cursor time in microseconds, on the same clock as sample timestamps. `undefined` until the source has data. */
	readonly time: number | undefined;
	readonly playback: Playback;
	readonly speed: number;
	/** How fast the cursor will move during playback, including compressed spans and export previews. */
	readonly playbackRate: number;
	/** Changes when the cursor is moved explicitly rather than advancing with playback. */
	readonly seekRevision: number;
	/** The local video driving playback, if the current portion of the log has one. */
	readonly playbackClock: PlaybackClock | undefined;
	readonly live: boolean;
	/** The range of the video being exported, which the cursor stays in. `undefined` outside video export mode. */
	readonly videoRange: TimeRange | undefined;
};

export const playbackSpeeds = [0.25, 0.5, 1, 2, 4, 8];

/** How far a step moves the cursor (µs), one robot loop */
const stepSize = 20_000;

// The one time cursor shared by every dashboard and widget
const store = createAtom<Timeline>({
	time: undefined,
	playback: 'paused',
	speed: 1,
	playbackRate: 1,
	seekRevision: 0,
	playbackClock: undefined,
	live: false,
	videoRange: undefined,
});

/** The timeline bar's cursor, frozen at its last time while the bar animates out. */
export const TimelineCursorContext = createContext<number | undefined>(undefined);

/** How many logs to remember the cursor time of, the least recently saved are forgotten first */
const maxSavedLogs = 100;

// Cursor time (µs) of recently opened logs by file name, restored when a log is reopened
const savedTimes = createPersistedAtom('log-cursor-times', z.record(z.string(), z.number()), {});
// File name of the time base when it's a log, `undefined` for live sources
let logName: string | undefined;
// How far (µs) the time base log was moved from its own clock, its cursor is saved on its own clock
let logOffset = 0;

let frame: number | undefined;
let lastFrameTime = 0;
// While a video is saved, only its frames move the cursor
let savingVideo = false;

function clamp(time: number, range: TimeRange): number {
	return Math.min(Math.max(time, range.start), range.end);
}

/** Where the cursor can go: the video range, or the whole source */
export function getCursorRange(): TimeRange | undefined {
	return store.get().videoRange ?? getTimeRange();
}

function update(changes: Partial<Timeline>, spans?: readonly CompressedSpan[]): void {
	const next = { ...store.get(), ...changes };
	const { playback, time, speed, videoRange } = next;
	const range = playback === 'playing' && !videoRange ? getTimeRange() : undefined;
	const compressed =
		time !== undefined && range !== undefined
			? (spans ?? getActiveCompressedSpans(range)).find((span) => span.start <= time && time < span.end)
			: undefined;
	const playbackClock =
		range && !next.live && !compressed && time !== undefined ? videoClockAt(time - range.origin, speed) : undefined;
	store.set({ ...next, playbackRate: rateInSpan(videoRange ? 1 : speed, compressed), playbackClock });

	const playing = store.get().playback === 'playing';
	if (playing && frame === undefined) {
		lastFrameTime = performance.now();
		frame = requestAnimationFrame(tick);
	} else if (!playing && frame !== undefined) {
		cancelAnimationFrame(frame);
		frame = undefined;
	}
}

function tick(now: number): void {
	frame = undefined;
	const { time, speed, live, videoRange, playbackClock } = store.get();
	const sourceRange = getTimeRange();
	const range = videoRange ?? sourceRange;
	if (time === undefined || range === undefined || sourceRange === undefined) {
		update({ playback: 'paused' });
		return;
	}

	const elapsed = Math.max(0, now - lastFrameTime);
	lastFrameTime = now;
	// Exports preview at the source's own timing. With compression, stop at the span end without skipping past it.
	const spans = videoRange ? [] : getActiveCompressedSpans(sourceRange);
	const compressed = spans.find((span) => span.start <= time && time < span.end);
	const rate = rateInSpan(videoRange ? 1 : speed, compressed);
	const driven = compressed ? undefined : timeFromVideo(playbackClock, time, sourceRange.origin, spans);
	const next = driven ?? Math.min(time + elapsed * 1000 * rate, compressed?.end ?? Infinity);

	if (next >= range.end) {
		update({ time: range.end, playback: live && !videoRange ? 'following' : 'paused' });
	} else {
		frame = requestAnimationFrame(tick);
		update({ time: next }, spans);
	}
}

/**
 * Follow the newest data, place a cursor that hasn't been placed yet once the sources have data, or keep the cursor in
 * range when it shrinks, ex. when a source is closed
 */
function syncToData(): void {
	const range = getTimeRange();
	if (range === undefined) {
		return;
	}

	const { time, playback } = store.get();
	if (playback === 'following') {
		if (time !== range.end) {
			update({ time: range.end });
		}
	} else if (time === undefined) {
		const saved = logName === undefined ? undefined : savedTimes.get()[logName];
		update({ time: saved === undefined ? range.origin : clamp(saved + logOffset, range) });
	} else if (time !== clamp(time, range)) {
		update({ time: clamp(time, range) });
	}
}

subscribeData(syncToData);

// Save the cursor of the active log when it settles, saving every frame while playing or saving a video would be wasteful
store.subscribe(({ time, playback }) => {
	if (
		logName === undefined ||
		time === undefined ||
		playback === 'playing' ||
		savingVideo ||
		savedTimes.get()[logName] === time - logOffset
	) {
		return;
	}
	const times = { ...savedTimes.get() };
	// Re-add the log so it's the most recently saved
	delete times[logName];
	times[logName] = time - logOffset;
	savedTimes.set(Object.fromEntries(Object.entries(times).slice(-maxSavedLogs)));
});

/**
 * Start the cursor over for a new source: live sources follow the newest data, logs start paused where the cursor was
 * when the log was last open, or at the beginning. `offset` is how far the log was moved from its own clock.
 */
export function resetTimeline(source: Source | undefined, offset = 0): void {
	const live = source?.type === 'live';
	logName = source?.type === 'log' ? source.fileName : undefined;
	logOffset = offset;
	update({ time: undefined, playback: live ? 'following' : 'paused', live, videoRange: undefined });
}

/**
 * Use `source` as the time base, the source whose clock and robot mode the timeline uses. `fresh` starts the cursor
 * over, ex. when the first source opens, otherwise it stays at the same moment. The cursor only follows the newest data
 * while the live session is the time base. Call it before showing the sources' data, which places the cursor.
 */
export function setTimeBase(source: Source | undefined, offset: number, fresh: boolean): void {
	const { time, playback } = store.get();
	if (fresh || source === undefined || time === undefined) {
		resetTimeline(source, offset);
		return;
	}
	const live = source.type === 'live';
	logName = source.type === 'log' ? source.fileName : undefined;
	logOffset = offset;
	update({ live, playback: !live && playback === 'following' ? 'paused' : playback });
}

/** The full timeline state, re-renders on every cursor move */
export function useTimeline(): Timeline {
	return useSelector(store);
}

export const useLiveFollow = () => useSelector(store, ({ playback }) => playback === 'following');

/** The cursor time (µs), `undefined` until the source has data. @public */
export function useCursorTime(): number | undefined {
	return useSelector(store, (timeline) => timeline.time);
}

export function getTimeline(): Timeline {
	return store.get();
}

export function getCursorTime(): number | undefined {
	return store.get().time;
}

/**
 * Useful for widgets that draw outside React, ex. on a canvas.
 * @public
 */
export function subscribeTimeline(listener: () => void): () => void {
	const { unsubscribe } = store.subscribe(() => listener());
	return unsubscribe;
}

/** The range of the video being exported, `undefined` outside video export mode */
export function useVideoRange(): TimeRange | undefined {
	return useSelector(store, (timeline) => timeline.videoRange);
}

/**
 * Set the range of the video being exported, keeping the cursor in it, or `undefined` to stop exporting. Moves the cursor to the
 * `cursor` time and playback, or pauses. Returns the cursor and playback from before.
 */
export function setVideoRange(
	videoRange: TimeRange | undefined,
	cursor?: Pick<Timeline, 'time' | 'playback'>,
): Pick<Timeline, 'time' | 'playback'> {
	const { time, playback } = store.get();
	const next: Pick<Timeline, 'time' | 'playback'> = cursor ?? { time, playback: 'paused' };
	const nextTime = next.playback === 'following' ? (getTimeRange()?.end ?? next.time) : next.time;
	update({
		videoRange,
		playback: next.playback,
		time: videoRange && nextTime !== undefined ? clamp(nextTime, videoRange) : nextTime,
	});
	return { time, playback };
}

/** Show the frame at `time` (µs) of a video being saved, `undefined` once it's saved or canceled */
export function showVideoFrame(time: number | undefined): void {
	savingVideo = time !== undefined;
	// Video export mode can end before the last frame is shown, ex. when the log is replaced
	if (time !== undefined && store.get().videoRange) {
		update({ time, playback: 'paused' });
	}
}

/** Move the cursor to `time` (µs), ex. when the user clicks a graph. Stops following live data. */
export function seek(time: number): void {
	const range = getCursorRange();
	if (range === undefined || savingVideo) {
		return;
	}
	const current = store.get();
	const playback = current.playback === 'following' ? 'paused' : current.playback;
	update({ time: clamp(time, range), playback, seekRevision: current.seekRevision + 1 });
}

/** Stop following live data without moving the cursor, ex. when the user pans or scrolls a graph back in time. @public */
export function stopFollowing(): void {
	if (store.get().playback === 'following') {
		update({ playback: 'paused' });
	}
}

/** Jump to the newest data and follow it, or seek to the end of the video range */
export function goLive(): void {
	const { videoRange } = store.get();
	if (videoRange) {
		seek(videoRange.end);
		return;
	}
	update({ playback: 'following', time: getTimeRange()?.end ?? store.get().time });
}

export function togglePlayback(): void {
	const { time, playback, live, videoRange } = store.get();
	const range = getCursorRange();

	if (savingVideo) {
		// Saving a video shows its frames
	} else if (playback !== 'paused') {
		update({ playback: 'paused' });
	} else if (time !== undefined && range !== undefined) {
		// Replay a finished log or video range from the beginning
		update({ playback: 'playing', time: (!live || videoRange) && time >= range.end ? range.start : time });
	}
}

/** Pause and move the cursor one step forward or back */
export function step(direction: 1 | -1): void {
	const { time } = store.get();
	const range = getCursorRange();
	if (time !== undefined && range !== undefined && !savingVideo) {
		update({ time: clamp(time + direction * stepSize, range), playback: 'paused' });
	}
}

export function setSpeed(speed: number): void {
	update({ speed });
}

/** Switch to the next faster or slower playback speed. Videos always preview at 1×. */
export function changeSpeed(direction: 1 | -1): void {
	if (store.get().videoRange) {
		return;
	}
	const next = playbackSpeeds[playbackSpeeds.indexOf(store.get().speed) + direction];
	if (next !== undefined) {
		update({ speed: next });
	}
}
