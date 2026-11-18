import type { UseHotkeyDefinition } from '@tanstack/react-hotkeys';
import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
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
	/** Playback speed multiplier */
	readonly speed: number;
	/** Whether the active source is live */
	readonly live: boolean;
};

export const playbackSpeeds = [0.25, 0.5, 1, 2, 4, 8];

/** How far a step moves the cursor (µs), one robot loop */
const stepSize = 20_000;

// The one time cursor shared by every dashboard and widget
const store = createAtom<Timeline>({ time: undefined, playback: 'paused', speed: 1, live: false });

/** How many logs to remember the cursor time of, the least recently saved are forgotten first */
const maxSavedLogs = 100;

// Cursor time (µs) of recently opened logs by file name, restored when a log is reopened
const savedTimes = createPersistedAtom('log-cursor-times', z.record(z.string(), z.number()), {});
// File name of the active log, `undefined` for live sources
let logName: string | undefined;

let frame: number | undefined;
let lastFrameTime = 0;

function clamp(time: number, range: TimeRange): number {
	return Math.min(Math.max(time, range.start), range.end);
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
	const { time, speed, live } = store.get();
	const range = getTimeRange();
	if (time === undefined || range === undefined) {
		update({ playback: 'paused' });
		return;
	}

	const elapsed = Math.max(0, now - lastFrameTime);
	lastFrameTime = now;
	let next = time + elapsed * 1000 * speed;
	// Fast-forward through compressed spans, stopping at their end so the time kept after them isn't skipped too
	const compressed = getActiveCompressedSpans(range).find((span) => span.start <= time && time < span.end);
	if (compressed) {
		const fastForward = time + (elapsed / compressedPlaybackTime) * (compressed.end - compressed.start);
		next = Math.min(Math.max(next, fastForward), compressed.end);
	}

	if (next >= range.end) {
		// Playback caught up with live data, or reached the end of the log
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

// Save the cursor of the active log when it settles, saving every frame while playing would be wasteful
store.subscribe(({ time, playback }) => {
	if (logName === undefined || time === undefined || playback === 'playing' || savedTimes.get()[logName] === time) {
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
	update({ time: undefined, playback: live ? 'following' : 'paused', live });
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
 * Call `listener` when the cursor or playback state changes, at most once per frame while playing or following.
 * Useful for widgets that draw outside React, ex. on a canvas.
 * @public
 */
export function subscribeTimeline(listener: () => void): () => void {
	const { unsubscribe } = store.subscribe(() => listener());
	return unsubscribe;
}

/** Move the cursor to `time` (µs), ex. when the user clicks a graph. Stops following live data. */
export function seek(time: number): void {
	const range = getTimeRange();
	if (range === undefined) {
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
	const range = getTimeRange();

	if (playback !== 'paused') {
		update({ playback: 'paused' });
	} else if (time !== undefined && range !== undefined) {
		// Play a finished log from the beginning
		update({ playback: 'playing', time: !live && time >= range.end ? range.start : time });
	}
}

/** Pause and move the cursor one step forward or back */
export function step(direction: 1 | -1): void {
	const { time } = store.get();
	const range = getTimeRange();
	if (time !== undefined && range !== undefined) {
		update({ time: clamp(time + direction * stepSize, range), playback: 'paused' });
	}
}

/** Move the cursor `seconds` forward, or back if negative, without changing playback */
export function skip(seconds: number): void {
	const { time } = store.get();
	if (time !== undefined) {
		seek(time + seconds * 1_000_000);
	}
}

/** How far (µs) into a section the cursor has to be for going back to go to its start, instead of the section before */
const sectionRestartTime = 1_000_000;

/**
 * Move the cursor to the start of the next or previous section of the robot's mode, ex. the start of teleop, without changing playback.
 * Going back goes to the start of the current section first, like a music player. Skips 5 seconds without mode data.
 */
export function skipSection(direction: 1 | -1): void {
	const { time } = store.get();
	const range = getTimeRange();
	if (time === undefined || range === undefined) {
		return;
	}
	const starts = getModePeriods(range).map((period) => period.start);
	if (starts.length === 0) {
		skip(direction * 5);
	} else if (direction === 1) {
		seek(starts.find((start) => start > time) ?? range.end);
	} else {
		seek(starts.findLast((start) => start < time - sectionRestartTime) ?? range.start);
	}
}

function jumpToStart(): void {
	const range = getTimeRange();
	if (range !== undefined) {
		seek(range.start);
	}
}

/** Jump to the end of a log, or go live */
function jumpToEnd(): void {
	const range = getTimeRange();
	if (store.get().live) {
		goLive();
	} else if (range !== undefined) {
		seek(range.end);
	}
}

export function setSpeed(speed: number): void {
	update({ speed });
}

/** Switch to the next faster or slower playback speed */
export function changeSpeed(direction: 1 | -1): void {
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

/** Shortcuts that move the cursor, also given directly to the timeline slider since a focused slider skips them otherwise */
export const seekHotkeys: UseHotkeyDefinition[] = [
	{ hotkey: 'ArrowLeft', callback: () => skip(-5) },
	{ hotkey: 'ArrowRight', callback: () => skip(5) },
	{ hotkey: 'Shift+ArrowLeft', callback: () => skipSection(-1) },
	{ hotkey: 'Shift+ArrowRight', callback: () => skipSection(1) },
	{ hotkey: 'Home', callback: jumpToStart },
	{ hotkey: 'End', callback: jumpToEnd },
	// Mac laptops don't have Home and End, text fields keep these for moving to the start or end of a line
	{ hotkey: 'Mod+ArrowLeft', callback: jumpToStart, options: { ignoreInputs: true } },
	{ hotkey: 'Mod+ArrowRight', callback: jumpToEnd, options: { ignoreInputs: true } },
];
