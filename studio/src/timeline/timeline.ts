import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
import { createContext } from 'react';
import * as z from 'zod';
import { getGaps, getTimeRange, subscribeData, type TimeRange } from '@/data/data-store';
import type { Source } from '@/data/source';
import { createPersistedAtom } from '@/lib/persisted-store';
import { settingsStore } from '@/settings';
import { type CompressedSpan, getCompressedSpans, getModePeriods } from '@/timeline/events';

/** `following` keeps the cursor on the newest data, it's only used by live sources */
type Playback = 'paused' | 'playing' | 'following';

export type Timeline = {
	/** Cursor time in microseconds, on the same clock as sample timestamps. `undefined` until the source has data. */
	readonly time: number | undefined;
	readonly playback: Playback;
	readonly speed: number;
	readonly live: boolean;
	/** The range of the clip being recorded, which the cursor stays in. `undefined` outside Record mode. */
	readonly clip: TimeRange | undefined;
};

export const playbackSpeeds = [0.25, 0.5, 1, 2, 4, 8];

/** How far a step moves the cursor (µs), one robot loop */
const stepSize = 20_000;

// The one time cursor shared by every dashboard and widget
const store = createAtom<Timeline>({ time: undefined, playback: 'paused', speed: 1, live: false, clip: undefined });

/** The timeline bar's cursor, frozen at its last time while the bar animates out. */
export const TimelineCursorContext = createContext<number | undefined>(undefined);

/** How many logs to remember the cursor time of, the least recently saved are forgotten first */
const maxSavedLogs = 100;

// Cursor time (µs) of recently opened logs by file name, restored when a log is reopened
const savedTimes = createPersistedAtom('log-cursor-times', z.record(z.string(), z.number()), {});
// File name of the active log, `undefined` for live sources
let logName: string | undefined;

let frame: number | undefined;
let lastFrameTime = 0;
// While a clip is saved, only its frames move the cursor
let savingClip = false;

function clamp(time: number, range: TimeRange): number {
	return Math.min(Math.max(time, range.start), range.end);
}

/** Where the cursor can go: the clip being recorded, or the whole source */
export function getCursorRange(): TimeRange | undefined {
	return store.get().clip ?? getTimeRange();
}

function update(changes: Partial<Timeline>): void {
	store.set((timeline) => ({ ...timeline, ...changes }));

	const playing = store.get().playback === 'playing';
	if (playing && frame === undefined) {
		lastFrameTime = performance.now();
		frame = requestAnimationFrame(tick);
	} else if (!playing && frame !== undefined) {
		cancelAnimationFrame(frame);
		frame = undefined;
	}
}

/** About how long (ms) playback takes to fast-forward through a compressed disabled span */
const compressedPlaybackTime = 1500;

/** Long idle spans of the active source that are compressed on the timeline, empty when compression is turned off */
export function getActiveCompressedSpans(range: TimeRange): CompressedSpan[] {
	return settingsStore.get().timelineCompress
		? getCompressedSpans(getModePeriods(range), getGaps(), range, store.get().live)
		: [];
}

function tick(now: number): void {
	frame = undefined;
	const { time, speed, live, clip } = store.get();
	const sourceRange = getTimeRange();
	const range = clip ?? sourceRange;
	if (time === undefined || range === undefined || sourceRange === undefined) {
		update({ playback: 'paused' });
		return;
	}

	const elapsed = Math.max(0, now - lastFrameTime);
	lastFrameTime = now;
	// A clip previews at the log's own timing, like it's saved
	let next = time + elapsed * 1000 * (clip ? 1 : speed);
	// Fast-forward through compressed spans, stopping at their end so the time kept after them isn't skipped too
	const compressed = clip
		? undefined
		: getActiveCompressedSpans(sourceRange).find((span) => span.start <= time && time < span.end);
	if (compressed) {
		const fastForward = time + (elapsed / compressedPlaybackTime) * (compressed.end - compressed.start);
		next = Math.min(Math.max(next, fastForward), compressed.end);
	}

	if (next >= range.end) {
		update({ time: range.end, playback: live ? 'following' : 'paused' });
	} else {
		frame = requestAnimationFrame(tick);
		update({ time: next });
	}
}

subscribeData(() => {
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
		update({ time: saved === undefined ? range.start : clamp(saved, range) });
	}
});

// Save the cursor of the active log when it settles, saving every frame while playing or saving a clip would be wasteful
store.subscribe(({ time, playback }) => {
	if (
		logName === undefined ||
		time === undefined ||
		playback === 'playing' ||
		savingClip ||
		savedTimes.get()[logName] === time
	) {
		return;
	}
	const times = { ...savedTimes.get() };
	// Re-add the log so it's the most recently saved
	delete times[logName];
	times[logName] = time;
	savedTimes.set(Object.fromEntries(Object.entries(times).slice(-maxSavedLogs)));
});

/**
 * Reset the cursor when switching sources: live sources follow the newest data,
 * logs start paused where the cursor was when the log was last shown, or at the beginning
 */
export function resetTimeline(source: Source | undefined): void {
	const live = source?.type === 'live';
	logName = source?.type === 'log' ? source.fileName : undefined;
	update({ time: undefined, playback: live ? 'following' : 'paused', live, clip: undefined });
}

/** The full timeline state, re-renders on every cursor move */
export function useTimeline(): Timeline {
	return useSelector(store);
}

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

/** The clip being recorded, `undefined` outside Record mode */
export function useClip(): TimeRange | undefined {
	return useSelector(store, (timeline) => timeline.clip);
}

/**
 * Set the clip being recorded, keeping the cursor in it, or `undefined` to stop recording. Moves the cursor to the
 * `cursor` time and playback, or pauses. Returns the cursor and playback from before.
 */
export function setClip(
	clip: TimeRange | undefined,
	cursor?: Pick<Timeline, 'time' | 'playback'>,
): Pick<Timeline, 'time' | 'playback'> {
	const { time, playback } = store.get();
	const next: Pick<Timeline, 'time' | 'playback'> = cursor ?? { time, playback: 'paused' };
	update({ clip, playback: next.playback, time: clip && next.time !== undefined ? clamp(next.time, clip) : next.time });
	return { time, playback };
}

/** Show the frame at `time` (µs) of a clip being saved, `undefined` once it's saved or canceled */
export function showClipFrame(time: number | undefined): void {
	savingClip = time !== undefined;
	// Record mode can end before the last frame is shown, ex. when the log is replaced
	if (time !== undefined && store.get().clip) {
		update({ time, playback: 'paused' });
	}
}

/** Move the cursor to `time` (µs), ex. when the user clicks a graph. Stops following live data. */
export function seek(time: number): void {
	const range = getCursorRange();
	if (range === undefined || savingClip) {
		return;
	}
	const { playback } = store.get();
	update({ time: clamp(time, range), playback: playback === 'following' ? 'paused' : playback });
}

/** Stop following live data without moving the cursor, ex. when the user pans or scrolls a graph back in time. @public */
export function stopFollowing(): void {
	if (store.get().playback === 'following') {
		update({ playback: 'paused' });
	}
}

/** Jump to the newest data and follow it */
export function goLive(): void {
	update({ playback: 'following', time: getTimeRange()?.end ?? store.get().time });
}

export function togglePlayback(): void {
	const { time, playback, live } = store.get();
	const range = getCursorRange();

	if (savingClip) {
		// Saving a clip shows its frames
	} else if (playback !== 'paused') {
		update({ playback: 'paused' });
	} else if (time !== undefined && range !== undefined) {
		// Play a finished log from the beginning
		update({ playback: 'playing', time: !live && time >= range.end ? range.start : time });
	}
}

/** Pause and move the cursor one step forward or back */
export function step(direction: 1 | -1): void {
	const { time } = store.get();
	const range = getCursorRange();
	if (time !== undefined && range !== undefined && !savingClip) {
		update({ time: clamp(time + direction * stepSize, range), playback: 'paused' });
	}
}

export function setSpeed(speed: number): void {
	update({ speed });
}

/** Switch to the next faster or slower playback speed. Clips always preview at 1×. */
export function changeSpeed(direction: 1 | -1): void {
	if (store.get().clip) {
		return;
	}
	const next = playbackSpeeds[playbackSpeeds.indexOf(store.get().speed) + direction];
	if (next !== undefined) {
		update({ speed: next });
	}
}

/** Format a time (µs) as minutes and seconds since the start of the source, ex. `0:02.50` or `1:05.00` */
export function formatTime(time: number, start: number): string {
	// Round to hundredths first so 59.999 s becomes 1:00.00 instead of 0:60.00
	const hundredths = Math.round((time - start) / 10_000);
	const minutes = Math.floor(hundredths / 6000);
	const seconds = ((hundredths % 6000) / 100).toFixed(2).padStart(5, '0');
	return `${minutes}:${seconds}`;
}

/** Format a rough duration (µs) as minutes and whole seconds, ex. `3:49` */
export function formatRoughDuration(duration: number): string {
	const seconds = Math.round(duration / 1_000_000);
	return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
