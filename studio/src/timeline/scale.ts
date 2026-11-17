import type { CompressedSpan } from '@/timeline/events';

/** Share (%) of the timeline each compressed span takes */
const compressedWidth = 3;
/** Most (%) of the timeline that compressed spans can take together, so lots of them don't crowd out the rest */
const maxCompressedWidth = 40;

/** Converts between times (µs) and positions along the timeline (% of its width) */
export type TimeScale = {
	toPercent: (time: number) => number;
	toTime: (percent: number) => number;
};

/** Linear interpolation of `value` between the points `from` and `to` */
function interpolate(value: number, from: readonly number[], to: readonly number[]): number {
	let index = 1;
	while (index < from.length - 1 && value > from[index]!) {
		index++;
	}
	const [fromStart, fromEnd, toStart, toEnd] = [from[index - 1]!, from[index]!, to[index - 1]!, to[index]!];
	return fromEnd === fromStart ? toStart : toStart + ((value - fromStart) / (fromEnd - fromStart)) * (toEnd - toStart);
}

/**
 * A scale from `start` across `duration` (µs), where each compressed span takes a small fixed width and the rest of the
 * time shares what's left evenly
 */
export function createTimeScale(start: number, duration: number, compressed: readonly CompressedSpan[]): TimeScale {
	if (duration <= 0) {
		return { toPercent: () => 100, toTime: () => start };
	}

	const spanWidth = Math.min(compressedWidth, maxCompressedWidth / Math.max(compressed.length, 1));
	const compressedTime = compressed.reduce((total, span) => total + span.end - span.start, 0);
	// Percent per µs of the time that isn't compressed
	const rate = (100 - spanWidth * compressed.length) / (duration - compressedTime);

	// Matching points in time and percent, linear between them
	const times = [start];
	const percents = [0];
	let position = 0;
	for (const span of compressed) {
		position += (span.start - times.at(-1)!) * rate;
		times.push(span.start, span.end);
		percents.push(position, position + spanWidth);
		position += spanWidth;
	}
	times.push(start + duration);
	percents.push(100);

	return {
		toPercent: (time) => interpolate(time, times, percents),
		toTime: (percent) => interpolate(percent, percents, times),
	};
}
