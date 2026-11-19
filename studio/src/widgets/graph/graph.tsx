import 'uplot/dist/uPlot.min.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useSettings } from '@/settings';
import { accentColor } from '@/theme/theme-color';
import { seriesUnits } from '@/widgets/graph/axis-units';
import { BandRow } from '@/widgets/graph/band-row';
import { DropZones } from '@/widgets/graph/drop-zones';
import { rowHeight } from '@/widgets/graph/bands';
import { bandPalette } from '@/widgets/graph/colors';
import { AxisUnit, GraphLegend } from '@/widgets/graph/graph-legend';
import { GraphTooltip } from '@/widgets/graph/graph-tooltip';
import { axisWidth, edgeInset, type PlotSeries } from '@/widgets/graph/plot';
import { RangeSelection } from '@/widgets/graph/range-selection';
import { graphSection } from '@/widgets/graph/roles';
import { TimeAxis } from '@/widgets/graph/time-axis';
import { type GraphElements, useGraphDrawing } from '@/widgets/graph/use-graph-drawing';
import { useGraphPointer } from '@/widgets/graph/use-graph-pointer';
import { useGraphShown } from '@/widgets/graph/view';
import { bindingColor } from '@/widgets/series-color';
import type { WidgetProps } from '@/widgets/widget-type';

export function Graph({ bindings }: WidgetProps) {
	const settings = useSettings();
	const accent = accentColor(settings.themePreset, settings.themeColor);
	const palette = useMemo(() => bandPalette(accent), [accent]);

	const { plotted, discrete } = useMemo(() => {
		const lines = bindings.filter((binding) => graphSection(binding.role) !== 'discrete');
		return { plotted: lines, discrete: bindings.filter((binding) => graphSection(binding.role) === 'discrete') };
	}, [bindings]);
	const units = useMemo(() => seriesUnits(plotted), [plotted]);
	const series = useMemo(
		() =>
			plotted.flatMap((binding, index): PlotSeries[] =>
				binding.entry
					? [
							{
								id: binding.id,
								entry: binding.entry,
								axis: graphSection(binding.role) === 'right' ? 'y2' : 'y',
								color: bindingColor(binding, index),
								hidden: binding.hidden,
								convert: units.units.get(binding.id)!.convert,
							},
						]
					: [],
			),
		[plotted, units],
	);
	const bandEntries = useMemo(() => discrete.map((binding) => binding.entry), [discrete]);
	const hasPlot = plotted.length > 0;
	const hasRight = series.some((line) => line.axis === 'y2');
	const insets = { left: hasPlot ? axisWidth : edgeInset, right: hasRight ? axisWidth : edgeInset };

	const plotRef = useRef<HTMLDivElement>(null);
	const bandsRef = useRef<HTMLCanvasElement>(null);
	const areaRef = useRef<HTMLDivElement>(null);
	const cursorLineRef = useRef<HTMLDivElement>(null);
	const hoverLineRef = useRef<HTMLDivElement>(null);
	const hoverDeltaRef = useRef<HTMLDivElement>(null);
	const hoverDotsRef = useRef<HTMLDivElement>(null);
	// Refs never change, so drawing only starts over when the entries or palette do
	const elements = useMemo(
		(): GraphElements => ({
			plot: plotRef,
			bands: bandsRef,
			area: areaRef,
			cursorLine: cursorLineRef,
			hoverLine: hoverLineRef,
			hoverDelta: hoverDeltaRef,
			hoverDots: hoverDotsRef,
		}),
		[],
	);
	// Unit labels go above the y-axes
	const plotTop = units.axes.y === undefined && units.axes.y2 === undefined ? edgeInset : 20;
	// The timeline bar marks the time graphs show
	useGraphShown();
	const graph = useGraphDrawing(elements, series, bandEntries, palette, plotTop);
	const body = useRef<HTMLDivElement>(null);
	const { bandHover, pointerAt, selection, pinned, handlers } = useGraphPointer(
		body,
		areaRef,
		bandsRef,
		graph,
		rowHeight,
	);
	/**
	 * Where the graph is in the window when hovered, clicked, or resized while the tooltip is pinned, since the tooltip is
	 * drawn over the whole window. `undefined` while hidden, ex. by another pane that's zoomed.
	 */
	const [origin, setOrigin] = useState<{ left: number; top: number; width: number }>();
	const measureOrigin = useCallback(() => {
		if (!body.current!.checkVisibility()) {
			setOrigin(undefined);
			return;
		}
		const { left, top, width } = body.current!.getBoundingClientRect();
		setOrigin((previous) =>
			previous?.left === left && previous.top === top && previous.width === width ? previous : { left, top, width },
		);
	}, []);
	useEffect(() => {
		if (!pinned) {
			return undefined;
		}
		let stopped = false;
		const observer = new ResizeObserver(() => {
			// Panes slide back in when a zoomed pane is restored, moving the graph without resizing it, so it's measured
			// once it lands
			const moving = document
				.getAnimations()
				.filter(
					(animation) =>
						animation.effect instanceof KeyframeEffect && animation.effect.target?.contains(body.current) === true,
				);
			if (moving.length === 0) {
				measureOrigin();
				return;
			}
			setOrigin(undefined);
			void Promise.all(moving.map((animation) => animation.finished)).then(
				() => !stopped && measureOrigin(),
				// Canceled by another layout change, which the observer sees
				() => undefined,
			);
		});
		observer.observe(body.current!);
		return () => {
			stopped = true;
			observer.disconnect();
		};
	}, [measureOrigin, pinned]);

	return (
		<div className="flex h-full flex-col">
			<GraphLegend plotted={plotted} />
			<div
				ref={body}
				className="relative flex min-h-0 flex-1 cursor-crosshair touch-none flex-col"
				{...handlers}
				onPointerDownCapture={measureOrigin}
				onPointerMoveCapture={measureOrigin}
			>
				{hasPlot && <div ref={plotRef} className="min-h-24 flex-1 overflow-hidden" />}
				{hasPlot && <AxisUnit label={units.axes.y} side="left" />}
				{hasRight && <AxisUnit label={units.axes.y2} side="right" />}
				<div className="relative shrink-0" style={{ height: discrete.length * rowHeight }}>
					{discrete.map((binding, row) => (
						<BandRow key={binding.id} binding={binding} row={row} insets={insets} />
					))}
					<canvas
						ref={bandsRef}
						// Canvases don't stretch between `left` and `right` like other elements, so set the width
						className="pointer-events-none absolute top-0"
						style={{
							left: insets.left,
							width: `calc(100% - ${insets.left + insets.right}px)`,
							height: discrete.length * rowHeight,
						}}
					/>
				</div>
				{!hasPlot && <div className="flex-1" />}
				<div
					ref={areaRef}
					className="pointer-events-none absolute inset-y-0"
					style={{ left: insets.left, right: insets.right }}
				>
					{selection && <RangeSelection selection={selection} plotted={plotted} units={units.units} />}
					<div ref={hoverLineRef} hidden className="absolute inset-y-0 w-px -translate-x-1/2 bg-muted-foreground/60" />
					<div ref={cursorLineRef} hidden className="absolute inset-y-0 w-px -translate-x-1/2 bg-foreground" />
					<div ref={hoverDotsRef} className="absolute top-0 left-0">
						{series.map((line) => (
							<div
								key={line.id}
								hidden
								className="absolute -top-1 -left-1 size-2 rounded-full ring-2 ring-background"
								style={{ background: line.color }}
							/>
						))}
					</div>
					{/* The 2px end strokes extend 1px to either side of each time marker. */}
					<div
						ref={hoverDeltaRef}
						hidden
						className={cn(
							'absolute h-2 before:absolute before:inset-y-0 before:-inset-x-px before:border-x-2 before:border-b-2 before:border-primary',
							(!pointerAt || selection) && 'hidden',
						)}
						style={{ bottom: (hasPlot ? discrete.length * rowHeight : 0) + 8 }}
					>
						<span className="absolute bottom-full left-1/2 w-max translate-x-(--delta-label-shift) rounded-sm border border-primary/40 bg-background px-1.5 text-xs font-medium text-foreground tabular-nums" />
					</div>
				</div>
				<GraphTooltip
					bandHover={bandHover}
					bandEntry={bandHover && discrete[bandHover.row]?.entry}
					at={pointerAt}
					pinned={pinned}
					origin={origin}
					plotted={plotted}
					units={units.units}
					insets={insets}
				/>
				<DropZones bandsHeight={discrete.length * rowHeight} />
			</div>
			<TimeAxis leftInset={insets.left} rightInset={insets.right} />
		</div>
	);
}
