// The plotted lines, drawn by uPlot from the points `stepLine()` picks, so it never draws more than a few per pixel
import uPlot from 'uplot';
import type { Entry, TimeRange } from '@/data/data-store';
import { stepLine } from '@/widgets/graph/decimate';
import { type createRangeAnimation, fitRange, type Range, wholeExtent } from '@/widgets/graph/y-range';

/** Width of a y-axis's labels */
export const axisWidth = 56;
/** Space at the edge of the plot without an axis */
export const edgeInset = 8;

export type PlotSeries = {
	id: string;
	entry: Entry;
	axis: 'y' | 'y2';
	/** A CSS color, `var()` included */
	color: string;
	hidden: boolean;
	/** Dash pattern in CSS pixels, empty for a solid line, see `sourceDash()` */
	dash: readonly number[];
	/** Converts values to the axis's unit */
	convert: (value: number) => number;
};

/** Range of a y-axis the user zoomed, the axis fits the data in view otherwise */
export type ManualRanges = Partial<Record<'y' | 'y2', [number, number]>>;

/** Resolves CSS colors like `var(--series-1)` for drawing on a canvas, read each time so theme changes apply */
function resolveColor(element: Element, color: string): string {
	const variable = /^var\((--[\w-]+)\)$/u.exec(color)?.[1];
	return variable === undefined ? color : getComputedStyle(element).getPropertyValue(variable).trim();
}

/** A y-axis label with as many decimals as the spacing between labels needs, ex. `0.000012` instead of uPlot's `0` */
function formatAxisValue(value: number, spacing: number): string {
	const decimals = Math.min(Math.max(-Math.floor(Math.log10(spacing)), 0), 12);
	// Trailing zeros only take up the axis's width, ex. `0.00006` instead of `0.000060`
	return decimals === 0 ? value.toFixed(0) : value.toFixed(decimals).replace(/\.?0+$/u, '');
}

function drawZeroLine(plot: uPlot, color: string): void {
	const y = plot.valToPos(0, 'y', true);
	const { left, top, width, height } = plot.bbox;
	if (!Number.isFinite(y) || y < top || y > top + height) {
		return;
	}
	const { ctx } = plot;
	ctx.save();
	ctx.strokeStyle = color;
	ctx.lineWidth = devicePixelRatio;
	ctx.beginPath();
	ctx.moveTo(left, Math.round(y) + 0.5);
	ctx.lineTo(left + width, Math.round(y) + 0.5);
	ctx.stroke();
	ctx.restore();
}

/** uPlot's types only describe aligned data, faceted series each have their own `[xs, ys]` after a `null` */
function facetedData(lines: readonly { xs: number[]; ys: (number | null)[] }[]): uPlot.AlignedData {
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- See above
	return [null, ...lines.map((line) => [line.xs, line.ys])] as unknown as uPlot.AlignedData;
}

export function createPlot(
	target: HTMLElement,
	series: readonly PlotSeries[],
	size: { width: number; height: number },
	/** Grid times, see `timeTicks()` */
	gridTimes: () => number[],
	/** Room above the plot, ex. for unit labels */
	top: number,
	/** Indexes of each series' points to mark with dots, set by `drawPlot()` */
	dots: { current: number[][] },
): uPlot {
	const color = (variable: string) => () => resolveColor(target, `var(${variable})`);
	// Gridlines stay faint so they don't compete with the data, the zero line is a little stronger
	const gridColor = () => `color-mix(in oklab, ${resolveColor(target, 'var(--color-border)')} 45%, transparent)`;
	const font = `12px ${getComputedStyle(target).fontFamily}`;
	const hasRight = series.some((line) => line.axis === 'y2');
	// The left axis keeps its space without entries, so the plot lines up with the bands, but it's left blank
	const hasLeft = series.some((line) => line.axis === 'y');
	const yAxis = (scale: 'y' | 'y2'): uPlot.Axis => ({
		scale,
		// oxlint-disable-next-line typescript/no-unsafe-enum-assignment -- uPlot's `Side` is a const enum, 3 is left and 1 is right
		side: scale === 'y' ? 3 : 1,
		size: axisWidth,
		gap: 4,
		font,
		stroke: color('--color-text-secondary'),
		ticks: { show: false },
		grid: { show: scale === 'y' ? hasLeft : !hasLeft, stroke: gridColor, width: 1 },
		values: (_plot, splits, _axis, _space, spacing) =>
			splits.map((value) => (scale === 'y' && !hasLeft ? '' : formatAxisValue(value, spacing))),
	});

	return new uPlot(
		{
			// oxlint-disable-next-line typescript/no-unsafe-enum-assignment -- uPlot's `Mode` is a const enum, 2 is faceted
			mode: 2,
			...size,
			padding: [top, hasRight ? 0 : edgeInset, edgeInset, 0],
			legend: { show: false },
			cursor: { show: false },
			hooks: { drawAxes: [(plot) => drawZeroLine(plot, resolveColor(target, 'var(--color-border)'))] },
			scales: {
				x: { time: false, auto: false },
				// Fit by `drawPlot()` and `setYRanges()`
				y: { auto: false },
				y2: { auto: false },
			},
			axes: [
				{
					scale: 'x',
					size: 0,
					gap: 0,
					ticks: { show: false },
					splits: gridTimes,
					values: (_plot, splits) => splits.map(() => ''),
					grid: { stroke: gridColor, width: 1 },
				},
				yAxis('y'),
				...(hasRight ? [yAxis('y2')] : []),
			],
			series: [
				// Faceted series have no shared x series
				{},
				...series.map((line): uPlot.Series => ({
					facets: [
						{ scale: 'x', auto: false },
						{ scale: line.axis, auto: true },
					],
					// Hidden lines fade out, see `useGraphDrawing()`
					show: true,
					alpha: line.hidden ? 0 : 1,
					stroke: () => resolveColor(target, line.color),
					width: 1.5,
					// uPlot scales the width to device pixels, but not the dash pattern
					...(line.dash.length > 0 && { dash: line.dash.map((length) => length * devicePixelRatio) }),
					// Positions aren't rounded to whole pixels, so lines glide instead of jumping while slowly zooming
					pxAlign: 0,
					paths: uPlot.paths.stepped!({ align: 1 }),
					points: {
						show: true,
						size: 5,
						fill: () => resolveColor(target, line.color),
						filter: (_plot, seriesIndex) => dots.current[seriesIndex - 1] ?? [],
					},
				})),
			],
		},
		facetedData(series.map(() => ({ xs: [], ys: [] }))),
		target,
	);
}

/** The range each y-axis heads to, fit to the data in view, see `fitRange()` */
export type YTargets = Partial<Record<'y' | 'y2', Range>>;

/**
 * Set the plotted data and sample dots across `view`. Returns the range each y-axis should show to fit the `fitted`
 * lines. Call inside the same uPlot batch as `setYRanges()` to draw the new data and scales together.
 */
export function drawPlot(
	plot: uPlot,
	series: readonly PlotSeries[],
	view: TimeRange,
	holdUntil: number,
	/** When the live session was disconnected, lines break there */
	gaps: readonly TimeRange[],
	dots: { current: number[][] },
	/** Whether the axes fit each line, ex. not hidden ones once they've faded out */
	fitted: readonly boolean[],
): YTargets {
	const lines = series.map((line) =>
		stepLine(line.entry.samples, view, plot.bbox.width / devicePixelRatio, holdUntil, line.convert, gaps),
	);
	dots.current = lines.map((line) => line.samples);
	plot.setData(facetedData(lines), false);
	plot.setScale('x', { min: view.start, max: view.end });

	const visible: Partial<Record<'y' | 'y2', Range>> = {};
	const whole: Partial<Record<'y' | 'y2', Range>> = {};
	for (const [index, line] of series.entries()) {
		const ys = lines[index]!.ys.filter((y) => y !== null);
		const extent = wholeExtent(line.entry.samples);
		if (fitted[index] !== true || ys.length === 0) {
			continue;
		}
		visible[line.axis] = union(visible[line.axis], [Math.min(...ys), Math.max(...ys)]);
		if (extent) {
			whole[line.axis] = union(whole[line.axis], [line.convert(extent[0]), line.convert(extent[1])]);
		}
	}
	return {
		y: visible.y && fitRange(visible.y, whole.y),
		y2: visible.y2 && fitRange(visible.y2, whole.y2),
	};
}

function union(range: Range | undefined, other: Range): Range {
	return range ? [Math.min(range[0], other[0]), Math.max(range[1], other[1])] : other;
}

/** The range of a y-axis without entries in view, it still needs one to be drawn and keep its space */
export const emptyAxisRange: Range = [0, 1];

export type RangeAnimations = Record<'y' | 'y2', ReturnType<typeof createRangeAnimation>>;

/** Sets each y-axis to the range the user zoomed it to, or eases it to its target. Returns whether one is still easing. */
export function setYRanges(
	plot: uPlot,
	targets: YTargets,
	manual: ManualRanges,
	animations: RangeAnimations,
	now: number,
): boolean {
	let animating = false;
	for (const axis of ['y', 'y2'] as const) {
		const target = targets[axis];
		const range = manual[axis] ?? (target && animations[axis].update(target, now));
		animating ||= manual[axis] === undefined && animations[axis].isAnimating(now);
		const [min, max] = range ?? emptyAxisRange;
		plot.setScale(axis, { min, max });
	}
	return animating;
}
