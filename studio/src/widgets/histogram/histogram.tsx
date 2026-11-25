import { colorVars, spacingVars, typeScaleVars, typographyVars } from '@astryxdesign/core/theme/tokens.stylex';
import { VisuallyHidden } from '@astryxdesign/core/VisuallyHidden';
import * as stylex from '@stylexjs/stylex';
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useEventListener } from 'usehooks-ts';
import { type Entry, subscribeData, type TimeRange } from '@/data/data-store';
import { formatValue } from '@/data/format-value';
import { useWidgetMenu } from '@/panes/widget-menu';
import { type SeriesUnit, seriesUnits } from '@/widgets/graph/axis-units';
import { axisWidth } from '@/widgets/graph/plot';
import { type Gesture, scrollTime, wheelListenerOptions } from '@/widgets/graph/scroll';
import { TimeAxis } from '@/widgets/graph/time-axis';
import { resetView, useGraphShown, useViewRange } from '@/widgets/graph/view';
import { type Analysis, analyzeSamples, histogramBins } from '@/widgets/histogram/data';
import { valueAxisEnd } from '@/widgets/histogram/format';
import { HistogramPlot } from '@/widgets/histogram/plot';
import { Legend } from '@/widgets/legend/legend';
import { NoData } from '@/widgets/no-data';
import { bindingColor } from '@/widgets/series-color';
import type { WidgetBinding, WidgetProps } from '@/widgets/widget-type';

type Range = readonly [number, number];

const styles = stylex.create({
	histogram: {
		display: 'flex',
		height: '100%',
		flexDirection: 'column',
	},
	summary: {
		maxHeight: '30%',
		flexShrink: 0,
		overflow: 'auto',
		paddingInline: spacingVars['--spacing-2'],
		paddingTop: spacingVars['--spacing-2'],
		paddingBottom: spacingVars['--spacing-3'],
	},
	table: {
		width: '100%',
		fontSize: typeScaleVars['--text-label-size'],
		lineHeight: '1.25rem',
	},
	headings: {
		fontSize: typeScaleVars['--text-supporting-size'],
		lineHeight: '1rem',
		color: colorVars['--color-text-secondary'],
	},
	heading: {
		fontWeight: 'normal',
	},
	entryHeading: {
		textAlign: 'start',
	},
	cell: {
		paddingInlineStart: spacingVars['--spacing-4'],
		textAlign: 'end',
	},
	entry: {
		width: '100%',
		maxWidth: 0,
		minWidth: '6rem',
		paddingBlock: spacingVars['--spacing-0-5'],
	},
	metric: {
		fontFamily: typographyVars['--font-family-code'],
		whiteSpace: 'nowrap',
		fontVariantNumeric: 'tabular-nums',
		userSelect: 'text',
	},
	empty: {
		whiteSpace: 'nowrap',
		color: colorVars['--color-text-secondary'],
	},
	body: {
		display: 'flex',
		minHeight: 0,
		flex: 1,
		flexDirection: 'column',
	},
	noSamples: {
		display: 'flex',
		minHeight: '6rem',
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		fontSize: typeScaleVars['--text-label-size'],
		lineHeight: '1.25rem',
		color: colorVars['--color-text-secondary'],
	},
	timeAxis: {
		paddingTop: spacingVars['--spacing-1-5'],
	},
});
type Series = { binding: WidgetBinding; entry: Entry; unit: SeriesUnit; color: string };

/** Keep the same snapshot until a series gains or loses samples in the selected range */
function analysesSnapshot(series: readonly Series[], time: TimeRange | undefined): () => (Analysis | undefined)[] {
	const cache = series.map(() => ({ start: -1, end: -1, rewrites: -1, analysis: undefined as Analysis | undefined }));
	let snapshot: (Analysis | undefined)[] = [];
	return () => {
		let changed = false;
		for (const [index, { entry, unit }] of series.entries()) {
			const { samples } = entry;
			const cached = cache[index]!;
			const start = time === undefined ? 0 : samples.indexAtOrAfter(time.start);
			const end = time === undefined ? samples.length : samples.indexAtOrBefore(time.end) + 1;
			if (start !== cached.start || end !== cached.end || samples.rewrites !== cached.rewrites) {
				cached.start = start;
				cached.end = end;
				cached.rewrites = samples.rewrites;
				cached.analysis = analyzeSamples(samples, start, end, unit.convert);
				changed = true;
			}
		}
		if (changed) {
			snapshot = cache.map((cached) => cached.analysis);
		}
		return snapshot;
	};
}

const metrics = [
	['Count', 'count'],
	['Min', 'min'],
	['Max', 'max'],
	['Mean', 'mean'],
	['Median', 'median'],
	['p95', 'p95'],
	['p99', 'p99'],
] as const;

export function Histogram({ bindings }: WidgetProps) {
	// The time range graphs show, which the timeline marks while it's zoomed in
	const time = useViewRange();
	useGraphShown();
	const names = useMemo(() => bindings.map((binding) => binding.name), [bindings]);
	// Entries measuring the same thing are converted to the first one's unit, like on a graph's axis
	const { units, axes } = useMemo(() => seriesUnits(bindings), [bindings]);
	const series = useMemo(
		() =>
			bindings.flatMap((binding, index): Series[] =>
				binding.entry
					? [{ binding, entry: binding.entry, unit: units.get(binding.id)!, color: bindingColor(binding, index) }]
					: [],
			),
		[bindings, units],
	);
	const snapshot = useMemo(() => analysesSnapshot(series, time), [series, time]);
	const analyses = useSyncExternalStore(subscribeData, snapshot);
	const shown = useMemo(
		() =>
			series.flatMap((item, index) => {
				const analysis = analyses[index];
				return !item.binding.hidden && analysis ? [{ ...item, analysis }] : [];
			}),
		[series, analyses],
	);

	// Keep zoom while the time range moves or series are hidden, but not for other entries, ex. another source's
	const [zoom, setZoom] = useState<{ entries: readonly Entry[]; range: Range }>();
	const range =
		zoom?.entries.length === series.length && zoom.entries.every((entry, index) => entry === series[index]!.entry)
			? zoom.range
			: undefined;
	const changeZoom = useCallback(
		(next: Range | undefined) => setZoom(next && { entries: series.map((item) => item.entry), range: next }),
		[series],
	);
	const histogram = useMemo(
		() =>
			shown.length > 0
				? histogramBins(
						shown.map((item) => item.analysis),
						range,
					)
				: undefined,
		[shown, range],
	);
	const plotSeries = useMemo(
		() =>
			shown.map((item) => ({
				id: item.binding.id,
				name: item.binding.name,
				color: item.color,
				total: item.analysis.count,
			})),
		[shown],
	);
	useWidgetMenu(() => ({
		actions: [
			{
				label: 'Reset view',
				onSelect: () => {
					changeZoom(undefined);
					resetView();
				},
			},
		],
	}));

	// Scrolling the histogram or its time axis zooms and pans the time range, like scrolling a graph. The plot spans the
	// same time as the axis below it.
	const body = useRef<HTMLDivElement>(null!);
	const timeAxis = useRef<HTMLDivElement>(null!);
	const gesture = useRef<Gesture>(undefined);
	useEventListener(
		'wheel',
		(event) => {
			event.preventDefault();
			// The axis's own element, inset like the plot
			scrollTime(event, timeAxis.current.firstElementChild!.getBoundingClientRect(), gesture);
		},
		body,
		wheelListenerOptions,
	);

	return (
		<div {...stylex.props(styles.histogram)}>
			{bindings.length > 0 && (
				<div {...stylex.props(styles.summary)}>
					<table {...stylex.props(styles.table)} aria-label="Summary">
						<thead>
							<tr {...stylex.props(styles.headings)}>
								<th scope="col" {...stylex.props(styles.heading, styles.entryHeading)}>
									<VisuallyHidden>Entry</VisuallyHidden>
								</th>
								{metrics.map(([label, key]) => (
									<th key={key} scope="col" {...stylex.props(styles.heading, styles.cell)}>
										{label}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{bindings.map((binding, index) => {
								const analysis = analyses[series.findIndex((item) => item.binding === binding)];
								return (
									<tr key={binding.id}>
										<td {...stylex.props(styles.entry)}>
											<Legend
												items={[
													{
														binding,
														color: bindingColor(binding, index),
														dimmed: binding.entry === undefined,
														distinctFrom: names,
														note: units.get(binding.id)?.label,
													},
												]}
												roles={false}
											/>
										</td>
										{binding.entry === undefined ? (
											<td colSpan={metrics.length} {...stylex.props(styles.cell)}>
												<NoData />
											</td>
										) : binding.hidden ? (
											<td colSpan={metrics.length} aria-label="Hidden" />
										) : analysis ? (
											metrics.map(([, key]) => (
												<td key={key} {...stylex.props(styles.cell, styles.metric)}>
													{key === 'count' ? analysis.count.toLocaleString() : formatValue(analysis[key])}
												</td>
											))
										) : (
											<td colSpan={metrics.length} {...stylex.props(styles.cell, styles.empty)}>
												No samples in range
											</td>
										)}
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}
			<div ref={body} {...stylex.props(styles.body)}>
				{histogram ? (
					<HistogramPlot series={plotSeries} unit={axes.y} histogram={histogram} range={range} onZoom={changeZoom} />
				) : (
					<div {...stylex.props(styles.noSamples)}>
						{series.some((item) => !item.binding.hidden) && 'No samples in range'}
					</div>
				)}
				<div ref={timeAxis} {...stylex.props(styles.timeAxis)}>
					<TimeAxis leftInset={axisWidth} rightInset={valueAxisEnd(axes.y)} />
				</div>
			</div>
		</div>
	);
}
