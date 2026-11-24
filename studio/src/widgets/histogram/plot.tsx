import 'uplot/dist/uPlot.min.css';
import { useCallback, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import uPlot from 'uplot';
import { formatValue } from '@/data/format-value';
import { settingsStore } from '@/settings';
import { axisWidth } from '@/widgets/graph/plot';
import type { histogramBins } from '@/widgets/histogram/data';
import { binCount, binLabel, binValues, type PlotSeries, valueAxisEnd } from '@/widgets/histogram/format';

type Histogram = ReturnType<typeof histogramBins>;
type Range = readonly [number, number];

const xAxisHeight = 23;
/** Room above the plot, like a graph's with unit labels, for how many samples are outside the view */
const plotTop = 20;

// oxlint-disable-next-line typescript/no-unsafe-enum-assignment -- uPlot declares its scale-value unit as a const enum.
const scaleValue: uPlot.Series.BarsPathBuilderFacetUnit = 1;

// A nonempty bin gets at least one visible pixel, even beside a much taller bin.
const heights: uPlot.Series.BarsPathBuilderDisplay = {
	y0: { unit: scaleValue, values: () => [] },
	y1: {
		unit: scaleValue,
		values: (plot, series) => {
			const minimum = plot.posToVal(plot.valToPos(0, 'y', true) - devicePixelRatio, 'y', true);
			return Array.from(plot.data[series]!, (count) =>
				typeof count === 'number' && count > 0 ? Math.max(count, minimum) : 0,
			);
		},
	},
};
const bars = uPlot.paths.bars!({ size: [1], disp: heights });
const singleBar = uPlot.paths.bars!({ size: [1, 32], disp: heights });

export function HistogramPlot({
	series,
	unit,
	histogram,
	range,
	onZoom,
}: {
	series: readonly PlotSeries[];
	/** The value axis's unit */
	unit: string | undefined;
	histogram: Histogram;
	range: Range | undefined;
	onZoom: (range: Range | undefined) => void;
}) {
	const [plot, setPlot] = useState<uPlot>();
	/** The bin whose readout is shown while it's hovered, focused with the keyboard, or tapped */
	const [active, setActive] = useState<number>();
	/** The bin focused when tabbing into the plot */
	const [tabStop, setTabStop] = useState(0);
	const { bins } = histogram;
	const activeIndex = active === undefined ? undefined : Math.min(active, bins.length - 1);
	// Recreates the chart only when the series' colors change, not on every render
	const colors = series.map((item) => item.color).join(' ');

	const zoom = useCallback(
		(next: Range | undefined) => {
			setActive(undefined);
			onZoom(next);
		},
		[onZoom],
	);

	const mount = useCallback(
		(target: HTMLDivElement | null) => {
			if (!target) {
				return undefined;
			}
			const colorList = colors.split(' ');
			const css = (variable: string) => () => getComputedStyle(target).getPropertyValue(variable).trim();
			const font = `12px ${getComputedStyle(target).fontFamily}`;
			const axis = { font, stroke: css('--muted-foreground'), ticks: { show: false }, gap: 4 };
			const chart = new uPlot(
				{
					width: target.clientWidth,
					height: target.clientHeight,
					padding: [plotTop, valueAxisEnd(unit), 0, 0],
					legend: { show: false },
					cursor: {
						x: false,
						y: false,
						points: { show: false },
						drag: { x: true, y: false, dist: 6, setScale: false },
						// uPlot normally ignores mouse events within children of the plot, including our bin buttons.
						bind: {
							mousedown: (_plot, _target, handle) => (event) => (event.button === 0 ? handle(event) : null),
							mousemove: (_plot, _target, handle) => handle,
						},
					},
					scales: { x: { time: false, auto: false }, y: { auto: false } },
					axes: [
						{
							...axis,
							size: xAxisHeight,
							grid: { show: false },
							values: (_plot, ticks) => ticks.map((tick) => formatValue(tick)),
						},
						{
							...axis,
							size: axisWidth,
							filter: (_plot, ticks) => ticks.map((tick) => (tick !== null && Number.isInteger(tick) ? tick : null)),
							// Faint like a graph's, so they don't compete with the data
							grid: { stroke: () => `color-mix(in oklab, ${css('--border')()} 45%, transparent)`, width: 1 },
							values: (_plot, ticks) => ticks.map((tick) => (tick === null ? '' : tick.toLocaleString())),
						},
					],
					series: [
						{},
						...colorList.map((color) => ({
							fill: css(color.slice(4, -1)),
							width: 0,
							// Overlapping series show through each other
							alpha: colorList.length > 1 ? 0.6 : 1,
							points: { show: false },
							paths: (self: uPlot, index: number, start: number, end: number) =>
								(self.data[0].length === 1 ? singleBar : bars)(self, index, start, end),
						})),
					],
					hooks: {
						setSelect: [
							(self) => {
								const { left, width } = self.select;
								self.setSelect({ left: 0, top: 0, width: 0, height: 0 }, false);
								const start = self.posToVal(left, 'x');
								const end = self.posToVal(left + width, 'x');
								if (start < end && self.data[0].length > 1) {
									zoom([start, end]);
								}
							},
						],
					},
				},
				[[], ...colorList.map(() => [])],
				target,
			);
			setPlot(chart);
			chart.ctx.canvas.setAttribute('aria-hidden', 'true');
			const resize = new ResizeObserver(() => {
				if (target.clientWidth > 0 && target.clientHeight > 0) {
					chart.setSize({ width: target.clientWidth, height: target.clientHeight });
				}
			});
			resize.observe(target);
			const redraw = () => chart.redraw(true, true);
			const settings = settingsStore.subscribe(redraw);
			const systemTheme = matchMedia('(prefers-color-scheme: dark)');
			systemTheme.addEventListener('change', redraw);
			return () => {
				resize.disconnect();
				settings.unsubscribe();
				systemTheme.removeEventListener('change', redraw);
				chart.destroy();
			};
		},
		[colors, unit, zoom],
	);

	useLayoutEffect(() => {
		// A chart replaced for other series is drawn once it's mounted
		if (plot === undefined || !plot.root.isConnected || plot.series.length !== bins[0]!.counts.length + 1) {
			return;
		}
		const [min, max] = range ?? [bins[0]!.start, bins.at(-1)!.end];
		const pad = min === max ? Math.max(Math.abs(min) * 0.005, 0.0001) : 0;
		const maxCount = Math.max(...bins.flatMap((bin) => bin.counts));
		plot.batch(() => {
			plot.setData(
				[
					bins.map((bin) => bin.start / 2 + bin.end / 2),
					...bins[0]!.counts.map((_, index) => bins.map((bin) => bin.counts[index]!)),
				],
				false,
			);
			plot.setScale('x', { min: min - pad, max: max + pad });
			plot.setScale('y', { min: 0, max: Math.max(1, maxCount * 1.06) });
		});
	}, [bins, range, plot]);

	const outside = histogram.outside.reduce((total, count) => total + count, 0);

	return (
		<figure
			className="relative min-h-24 min-w-0 flex-1 cursor-crosshair touch-none"
			aria-label={`Histogram of ${series.map((item) => item.name).join(', ')}`}
		>
			{/* uPlot's stylesheet isn't layered, so it overrides utilities without `!` */}
			<div
				className="absolute inset-0 [&_.u-select]:border-x! [&_.u-select]:border-primary! [&_.u-select]:bg-primary/10!"
				ref={mount}
			/>
			{range && (
				<span className="pointer-events-none absolute top-0.5 right-2 text-xs text-muted-foreground tabular-nums">
					{outside.toLocaleString()} outside view
				</span>
			)}
			{unit !== undefined && (
				// The value axis's unit after its last label, like a graph's unit at the end of its y-axis
				<span
					className="pointer-events-none absolute right-0 bottom-0 pt-1 text-xs leading-none text-muted-foreground"
					style={{ height: xAxisHeight }}
				>
					{unit}
				</span>
			)}
			{plot &&
				createPortal(
					<div
						className="absolute inset-0 flex capture:hidden"
						onPointerLeave={(event) => {
							if (event.pointerType !== 'touch') {
								setActive(undefined);
							}
						}}
					>
						{bins.map((bin, index) => (
							<button
								// oxlint-disable-next-line react/no-array-index-key -- Keep focus on the same column as live bin edges change.
								key={index}
								type="button"
								className="min-w-0 flex-1 cursor-crosshair hover:bg-foreground/8 focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
								aria-label={binLabel(bin, unit, series, index === bins.length - 1)}
								tabIndex={index === Math.min(tabStop, bins.length - 1) ? 0 : -1}
								onPointerEnter={(event) => {
									if (event.pointerType !== 'touch') {
										setActive(index);
									}
								}}
								onPointerDown={() => setActive(index)}
								onFocus={(event) => {
									setTabStop(index);
									if (event.currentTarget.matches(':focus-visible')) {
										setActive(index);
									}
								}}
								onBlur={() => setActive((current) => (current === index ? undefined : current))}
								onKeyDown={(event) => {
									if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
										event.preventDefault();
										event.stopPropagation();
										const next =
											event.currentTarget[event.key === 'ArrowLeft' ? 'previousElementSibling' : 'nextElementSibling'];
										if (next instanceof HTMLButtonElement) {
											next.focus();
										}
									}
								}}
							/>
						))}
						{activeIndex !== undefined && (
							<div
								className="pointer-events-none absolute top-1 z-10 w-max rounded-md border bg-popover px-2 py-1.5 text-xs whitespace-nowrap text-popover-foreground shadow-md"
								// Beside the bin, on the side with more room
								style={
									activeIndex < bins.length / 2
										? { left: `${(activeIndex / bins.length) * 100}%` }
										: { right: `${(1 - (activeIndex + 1) / bins.length) * 100}%` }
								}
							>
								<div className="font-medium tabular-nums">{binValues(bins[activeIndex]!, unit, '–')}</div>
								{series.map((item, index) => (
									<div key={item.id} className="flex items-center gap-1.5 text-muted-foreground tabular-nums">
										{series.length > 1 && (
											<span className="size-2 shrink-0 rounded-full" style={{ background: item.color }} />
										)}
										{binCount(bins[activeIndex]!.counts[index]!, item.total)}
									</div>
								))}
							</div>
						)}
					</div>,
					plot.over,
				)}
		</figure>
	);
}
