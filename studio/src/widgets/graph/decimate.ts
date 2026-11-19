import type { TimeRange } from '@/data/data-store';
import type { Samples } from '@/data/samples';

const sparsePixels = 6;
/** Samples at least this many pixels apart are marked, only when zoomed far in so they don't clutter the graph */
const markedPixels = 16;

/** Points of a step line, in the shape uPlot takes for a faceted series */
export type StepLine = {
	xs: number[];
	/** `null` breaks the line, ex. where the live session was disconnected */
	ys: (number | null)[];
	/** Indexes of `xs` and `ys` that are logged samples, empty when they're too dense to mark */
	samples: number[];
};

function isSparse(count: number, pixels: number): boolean {
	return count * sparsePixels <= pixels;
}

/** Whether samples are far enough apart to mark each one, `count` samples across `pixels` */
export function isMarked(count: number, pixels: number): boolean {
	return count * markedPixels <= pixels;
}

/**
 * The points to draw a numeric entry's step line across `view`, `pixels` wide. Starts at the sample before the view so the
 * held value is drawn from the left edge, and holds the last value until `holdUntil`, ex. the end of the source.
 * Dense samples are thinned to each pixel column's first, lowest, highest, and last values, so spikes stay visible.
 * Columns are a power of two wide and line up with time zero, so slowly panning or zooming doesn't reshuffle which
 * samples are kept and make the line wobble. They're up to a pixel wide, so up to two fit in each.
 * The line holds its value until the start of each gap in `gaps`, then breaks until the next sample.
 */
export function stepLine(
	samples: Samples,
	view: TimeRange,
	pixels: number,
	holdUntil: number,
	/** Converts values, ex. to another unit, keeping their order */
	convert: (value: number) => number = (value) => value,
	/** When nothing was received, sorted */
	gaps: readonly TimeRange[] = [],
): StepLine {
	const { timestamps, values } = samples;
	const first = Math.max(0, samples.indexAtOrBefore(view.start));
	const after = samples.indexAtOrAfter(view.end);
	const last = after < 0 ? samples.length - 1 : after;
	const line: StepLine = { xs: [], ys: [], samples: [] };
	if (last < first) {
		return line;
	}

	const sparse = isSparse(last - first + 1, pixels);
	const marked = isMarked(last - first + 1, pixels);
	const columnWidth = 2 ** Math.floor(Math.log2((view.end - view.start) / Math.max(pixels, 1)));
	let column = Number.NaN;
	// The current column's lowest and highest values, and which came first
	let low = 0;
	let high = 0;
	let lowFirst = true;
	let lastValue = 0;
	const flush = () => {
		if (!Number.isNaN(column)) {
			// The column's first value is already in, the rest share its x so they're drawn as one vertical stroke
			const x = line.xs.at(-1)!;
			line.xs.push(x, x, x);
			line.ys.push(lowFirst ? low : high, lowFirst ? high : low, lastValue);
		}
	};

	let gapIndex = 0;
	/** Hold the line's value until `gap` starts and break it there, if the line has started and hasn't reached it yet */
	const breakAt = (gap: TimeRange): boolean => {
		if (line.xs.length === 0 || line.xs.at(-1)! > gap.start || line.ys.at(-1) === null) {
			return false;
		}
		flush();
		column = Number.NaN;
		line.xs.push(gap.start, gap.start);
		line.ys.push(line.ys.at(-1)!, null);
		return true;
	};

	for (let index = first; index <= last; index++) {
		const logged = values[index];
		if (typeof logged !== 'number' || !Number.isFinite(logged)) {
			continue;
		}
		const value = convert(logged);
		const time = timestamps[index]!;
		while (gapIndex < gaps.length && gaps[gapIndex]!.end <= time) {
			breakAt(gaps[gapIndex++]!);
		}
		if (sparse) {
			if (marked) {
				line.samples.push(line.xs.length);
			}
			line.xs.push(time);
			line.ys.push(value);
			continue;
		}

		const valueColumn = Math.floor(time / columnWidth);
		if (valueColumn === column) {
			if (value < low) {
				low = value;
				lowFirst = false;
			} else if (value > high) {
				high = value;
				lowFirst = true;
			}
		} else {
			flush();
			column = valueColumn;
			low = value;
			high = value;
			lowFirst = true;
			line.xs.push(time);
			line.ys.push(value);
		}
		lastValue = value;
	}
	flush();

	// Hold the last value to the end of the source, or the edge of the view, unless a gap starts first
	const end = Math.min(holdUntil, view.end);
	const gap = gaps.slice(gapIndex).find((other) => other.start < end);
	if (gap && breakAt(gap)) {
		return line;
	}
	if (line.xs.length > 0 && line.xs.at(-1)! < end) {
		line.xs.push(end);
		line.ys.push(line.ys.at(-1)!);
	}
	return line;
}
