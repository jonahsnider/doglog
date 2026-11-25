import type { Entry, TimeRange } from '@/data/data-store';
import { formatValue } from '@/data/format-value';
import { bandColor, type BandPalette, bandTextColor, type ColorAssignments } from '@/widgets/graph/colors';

// Layout (px): each row is a label above a band
export const rowHeight = 44;
export const labelHeight = 16;
export const bandTop = 18;
export const bandHeight = 20;

/** The period of unchanged value around `time`, or `undefined` before the first sample */
export function bandAt(entry: Entry, time: number, end: number) {
	const { timestamps, values, length } = entry.samples;
	const index = entry.samples.indexAtOrBefore(time);
	if (index < 0) {
		return undefined;
	}

	const value = values[index];
	let first = index;
	while (first > 0 && values[first - 1] === value) {
		first--;
	}
	let next = index + 1;
	while (next < length && values[next] === value) {
		next++;
	}
	return { value, start: timestamps[first]!, end: next < length ? timestamps[next]! : end };
}

/** How many times the value changes from `start` to `end` */
export function changesIn(entry: Entry, start: number, end: number): number {
	const { timestamps, values, length } = entry.samples;
	let changes = 0;
	for (
		let index = Math.max(1, entry.samples.indexAtOrAfter(start));
		index < length && timestamps[index]! <= end;
		index++
	) {
		if (values[index] !== values[index - 1]) {
			changes++;
		}
	}
	return changes;
}

/** Diagonal stripes for pixels where the value changes more than once, so no band's color hides the others */
function hatch(context: CanvasRenderingContext2D, background: string): CanvasPattern {
	const tile = new OffscreenCanvas(6, 6);
	const tileContext = tile.getContext('2d')!;
	tileContext.fillStyle = background;
	tileContext.fillRect(0, 0, 6, 6);
	tileContext.strokeStyle = 'rgb(0 0 0 / 35%)';
	tileContext.beginPath();
	tileContext.moveTo(-1, 7);
	tileContext.lineTo(7, -1);
	tileContext.stroke();
	return context.createPattern(tile, 'repeat')!;
}

/**
 * Shade the parts of `view` the live session was disconnected for across the whole graph, one span in `container` for
 * each, reusing them from the last call
 */
export function placeGaps(container: HTMLDivElement, gaps: readonly TimeRange[], view: TimeRange, width: number): void {
	const visible = gaps.filter((gap) => gap.end > view.start && gap.start < view.end);
	while (container.childElementCount < visible.length) {
		const span = document.createElement('div');
		Object.assign(span.style, {
			position: 'absolute',
			top: '0',
			bottom: '0',
			left: '0',
			backgroundColor: 'color-mix(in srgb, var(--color-text-secondary) 12%, transparent)',
		});
		container.append(span);
	}
	while (container.childElementCount > visible.length) {
		container.lastElementChild!.remove();
	}
	const spans = container.querySelectorAll('div');
	const toX = (time: number) =>
		((Math.min(Math.max(time, view.start), view.end) - view.start) / (view.end - view.start)) * width;
	for (const [index, gap] of visible.entries()) {
		const left = toX(gap.start);
		spans[index]!.style.transform = `translateX(${left}px)`;
		spans[index]!.style.width = `${toX(gap.end) - left}px`;
	}
}

/** Draw each entry's bands across `view`, on a canvas as wide as the plot and as tall as the rows */
export function drawBands(
	canvas: HTMLCanvasElement,
	entries: readonly (Entry | undefined)[],
	view: TimeRange,
	/** When the live session was disconnected, left empty */
	gaps: readonly TimeRange[],
	assignments: ColorAssignments,
	palette: BandPalette,
): void {
	const width = canvas.clientWidth;
	const height = canvas.clientHeight;
	const scale = devicePixelRatio;
	if (canvas.width !== Math.round(width * scale) || canvas.height !== Math.round(height * scale)) {
		canvas.width = Math.round(width * scale);
		canvas.height = Math.round(height * scale);
	}

	const context = canvas.getContext('2d')!;
	context.setTransform(scale, 0, 0, scale, 0, 0);
	context.clearRect(0, 0, width, height);
	// Ex. a graph without bands. Chromium can't make the hatch pattern for an empty canvas.
	if (width === 0 || height === 0) {
		return;
	}
	context.font = `500 11px ${getComputedStyle(canvas).fontFamily}`;
	context.textBaseline = 'middle';
	const busy = hatch(context, palette.false);
	const toX = (time: number) => ((time - view.start) / (view.end - view.start)) * width;

	for (const [row, entry] of entries.entries()) {
		if (!entry) {
			continue;
		}

		const { timestamps, values, length } = entry.samples;
		const y = row * rowHeight + bandTop;
		const first = Math.max(0, entry.samples.indexAtOrBefore(view.start));
		// Changes narrower than a pixel are gathered until a wider band, then drawn hatched
		let narrow: { start: number; end: number; count: number } | undefined;
		const drawNarrow = () => {
			if (narrow) {
				const start = Math.floor(narrow.start);
				context.fillStyle = busy;
				context.fillRect(start, y, Math.max(Math.ceil(narrow.end) - start, 1), bandHeight);
				narrow = undefined;
			}
		};

		let index = first;
		while (index < length && timestamps[index]! <= view.end) {
			const value = values[index];
			let next = index + 1;
			while (next < length && values[next] === value) {
				next++;
			}

			const x = toX(Math.max(timestamps[index]!, view.start));
			const end = toX(next < length ? Math.min(timestamps[next]!, view.end) : view.end);
			if (end - x < 1) {
				narrow = narrow ? { ...narrow, end, count: narrow.count + 1 } : { start: x, end, count: 1 };
				index = next;
				continue;
			}
			if (narrow?.count === 1) {
				// A single narrow band keeps its color
				context.fillStyle = bandColor(assignments, palette, entry, values[index - 1]);
				context.fillRect(Math.floor(narrow.start), y, 1, bandHeight);
				narrow = undefined;
			}
			drawNarrow();

			const left = Math.round(x);
			const bandWidth = Math.round(end) - left;
			context.fillStyle = bandColor(assignments, palette, entry, value);
			// A 1px gap separates neighboring bands, in case two values share a color
			context.fillRect(left, y, bandWidth > 2 ? bandWidth - 1 : bandWidth, bandHeight);
			if (bandWidth > 12) {
				// Booleans shorten to t or f when true or false doesn't fit
				const text = [formatValue(value), ...(typeof value === 'boolean' ? [value ? 't' : 'f'] : [])].find(
					(label) => context.measureText(label).width + 8 <= bandWidth,
				);
				if (text !== undefined) {
					context.fillStyle = bandTextColor;
					context.fillText(text, left + 4, y + bandHeight / 2);
				}
			}
			index = next;
		}
		drawNarrow();
	}

	for (const gap of gaps) {
		const left = toX(gap.start);
		context.clearRect(left, 0, toX(gap.end) - left, height);
	}
}
