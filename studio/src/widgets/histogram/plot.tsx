import 'uplot/dist/uPlot.min.css';
import './plot.css';
import { colorVars, spacingVars, typeScaleVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import uPlot from 'uplot';
import { formatValue } from '@/data/format-value';
import { perFrame } from '@/lib/per-frame';
import { settingsStore } from '@/settings';
import { type Fade, isFading, opacityAt, updateFades } from '@/widgets/graph/fade';
import { axisWidth } from '@/widgets/graph/plot';
import type { histogramBins } from '@/widgets/histogram/data';
import { HistogramBins } from '@/widgets/histogram/bins';
import { type PlotSeries, valueAxisEnd } from '@/widgets/histogram/format';

type Histogram = ReturnType<typeof histogramBins>;
type Range = readonly [number, number];

const xAxisHeight = 23;
/** Overlapping series show through each other */
const overlapAlpha = 0.6;
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
const styles = stylex.create({
	figure: {
		position: 'relative',
		minHeight: '6rem',
		minWidth: 0,
		flex: 1,
		cursor: 'crosshair',
		touchAction: 'none',
	},
	chart: {
		position: 'absolute',
		inset: 0,
	},
	note: {
		pointerEvents: 'none',
		position: 'absolute',
		fontSize: typeScaleVars['--text-supporting-size'],
		color: colorVars['--color-text-secondary'],
	},
	outside: {
		top: spacingVars['--spacing-0-5'],
		right: spacingVars['--spacing-2'],
		lineHeight: '1rem',
		fontVariantNumeric: 'tabular-nums',
	},
	unit: {
		right: 0,
		bottom: 0,
		paddingTop: spacingVars['--spacing-1'],
		lineHeight: 1,
	},
});

const bars = uPlot.paths.bars!({ size: [1], disp: heights });
const singleBar = uPlot.paths.bars!({ size: [1, 32], disp: heights });

/** Fades series other than the `highlighted` binding's, see `updateFades()`, returning a function that stops it */
function fadeSeries(
	plot: uPlot,
	lines: readonly { id: string; binding: string; hidden: boolean }[],
	highlighted: string | undefined,
	fades: Map<string, Fade>,
): () => void {
	const base = lines.length > 1 ? overlapAlpha : 1;
	updateFades(fades, lines, highlighted, performance.now());
	const animate = perFrame(() => {
		const now = performance.now();
		let fading = false;
		for (const [index, line] of lines.entries()) {
			const fade = fades.get(line.id)!;
			plot.series[index + 1]!.alpha = base * opacityAt(fade, now);
			fading = isFading(fade, now) || fading;
		}
		plot.redraw(false);
		if (fading) {
			animate.schedule();
		}
	});
	animate.schedule();
	return animate.cancel;
}

export function HistogramPlot({
	series,
	highlighted,
	unit,
	histogram,
	range,
	onZoom,
}: {
	series: readonly PlotSeries[];
	/** The binding whose series stays as it is while the others fade, see `updateFades()` */
	highlighted: string | undefined;
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

	const zoom = (next: Range | undefined) => {
		setActive(undefined);
		onZoom(next);
	};

	const mount = (target: HTMLDivElement | null) => {
		if (!target) {
			return undefined;
		}
		const colorList = colors.split(' ');
		const css = (variable: string) => () => getComputedStyle(target).getPropertyValue(variable).trim();
		const font = `12px ${getComputedStyle(target).fontFamily}`;
		const axis = { font, stroke: css('--color-text-secondary'), ticks: { show: false }, gap: 4 };
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
						grid: {
							stroke: () => `color-mix(in oklab, ${css('--color-border')()} 45%, transparent)`,
							width: 1,
						},
						values: (_plot, ticks) => ticks.map((tick) => (tick === null ? '' : tick.toLocaleString())),
					},
				],
				series: [
					{},
					...colorList.map((color) => ({
						fill: css(color.slice(4, -1)),
						width: 0,
						alpha: colorList.length > 1 ? overlapAlpha : 1,
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
	};

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

	const fades = useRef(new Map<string, Fade>());
	const ids = series.map((item) => item.id).join(' ');
	useEffect(() => {
		const lines = ids.split(' ').map((id) => ({ id, binding: id, hidden: false }));
		if (plot === undefined || plot.series.length !== lines.length + 1) {
			return undefined;
		}
		return fadeSeries(plot, lines, highlighted, fades.current);
	}, [plot, ids, highlighted]);

	const outside = histogram.outside.reduce((total, count) => total + count, 0);

	return (
		<figure {...stylex.props(styles.figure)} aria-label={`Histogram of ${series.map((item) => item.name).join(', ')}`}>
			<div {...stylex.props(styles.chart)} data-histogram-plot ref={mount} />
			{range && <span {...stylex.props(styles.note, styles.outside)}>{outside.toLocaleString()} outside view</span>}
			{unit !== undefined && (
				// The value axis's unit after its last label, like a graph's unit at the end of its y-axis
				<span {...stylex.props(styles.note, styles.unit)} style={{ height: xAxisHeight }}>
					{unit}
				</span>
			)}
			{plot &&
				createPortal(
					<HistogramBins
						bins={bins}
						unit={unit}
						series={series}
						active={activeIndex}
						setActive={setActive}
						tabStop={tabStop}
						setTabStop={setTabStop}
					/>,
					plot.over,
				)}
		</figure>
	);
}
