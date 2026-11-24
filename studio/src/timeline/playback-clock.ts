import type { TimeRange } from '@/data/data-store';

export type PlaybackClock = {
	/** The clip's range in microseconds since the start of the log. */
	readonly range: TimeRange;
	readonly maxRate: number;
	/** Time on that same clock, `null` while waiting for a frame, `undefined` when not playing. */
	readonly read: () => number | null | undefined;
};

const videos = new Set<{ clock: PlaybackClock | undefined }>();

/** A video without a clock still counts when deciding if one video can drive the dashboard. */
export function registerPlaybackVideo(clock: PlaybackClock | undefined): () => void {
	const video = { clock };
	videos.add(video);
	return () => {
		videos.delete(video);
	};
}

function singleVideoClock(): PlaybackClock | undefined {
	return videos.size === 1 ? videos.values().next().value?.clock : undefined;
}

export function videoClockAt(time: number, speed: number): PlaybackClock | undefined {
	const clock = singleVideoClock();
	return clock && time >= clock.range.start && time < clock.range.end && speed <= clock.maxRate ? clock : undefined;
}

/** A clock can hold the cursor, but can't take it backwards or skip a compressed span boundary. */
export function timeFromVideo(
	clock: PlaybackClock | undefined,
	time: number,
	logStart: number,
	spans: readonly TimeRange[],
): number | undefined {
	if (!clock || clock !== singleVideoClock()) {
		return undefined;
	}
	const next = clock.read();
	if (next === null || next === undefined) {
		return next === null ? time : undefined;
	}
	const boundary = spans.find((span) => span.start > time)?.start ?? Infinity;
	return Math.max(time, Math.min(logStart + Math.min(next, clock.range.end), boundary));
}
