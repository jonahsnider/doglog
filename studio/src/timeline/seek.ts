import type { UseHotkeyDefinition } from '@tanstack/react-hotkeys';
import { getTimeRange } from '@/data/data-store';
import { getModePeriods } from '@/timeline/events';
import { getCursorRange, getTimeline, goLive, seek } from '@/timeline/timeline';

/** Move the cursor `seconds` forward, or back if negative, without changing playback */
export function skip(seconds: number): void {
	const { time } = getTimeline();
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
	const { time } = getTimeline();
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
	const range = getCursorRange();
	if (range !== undefined) {
		seek(range.start);
	}
}

function jumpToEnd(): void {
	const range = getCursorRange();
	if (getTimeline().live) {
		goLive();
	} else if (range !== undefined) {
		seek(range.end);
	}
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
