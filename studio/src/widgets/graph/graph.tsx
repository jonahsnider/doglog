import 'uplot/dist/uPlot.min.css';
import * as stylex from '@stylexjs/stylex';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { seriesUnits } from '@/widgets/graph/axis-units';
import { BandRow } from '@/widgets/graph/band-row';
import { DropZones } from '@/widgets/graph/drop-zones';
import { rowHeight } from '@/widgets/graph/bands';
import { bandPalette, type ColorAssignments } from '@/widgets/graph/colors';
import { AxisUnit, GraphLegend } from '@/widgets/graph/graph-legend';
import { GraphOverlay } from '@/widgets/graph/graph-overlay';
import { GraphTooltip } from '@/widgets/graph/graph-tooltip';
import { axisWidth, edgeInset, type PlotSeries } from '@/widgets/graph/plot';
import { graphSection } from '@/widgets/graph/roles';
import { TimeAxis } from '@/widgets/graph/time-axis';
import { type GraphElements, useGraphDrawing } from '@/widgets/graph/use-graph-drawing';
import { useGraphPointer } from '@/widgets/graph/use-graph-pointer';
import { resetView, useGraphShown } from '@/widgets/graph/view';
import { useWidgetMenu } from '@/panes/widget-menu';
import { bindingColor } from '@/widgets/series-color';
import type { WidgetProps } from '@/widgets/widget-type';

const styles = stylex.create({
	graph: {
		display: 'flex',
		height: '100%',
		flexDirection: 'column',
	},
	body: {
		position: 'relative',
		display: 'flex',
		minHeight: 0,
		flex: 1,
		flexDirection: 'column',
		cursor: 'crosshair',
		touchAction: 'none',
	},
	plot: {
		minHeight: '6rem',
		flex: 1,
		overflow: 'hidden',
		contain: 'strict',
	},
	bands: {
		position: 'relative',
		flexShrink: 0,
	},
	bandsCanvas: {
		pointerEvents: 'none',
		position: 'absolute',
		top: 0,
	},
	spacer: {
		flex: 1,
	},
});

export function Graph({ bindings }: WidgetProps) {
	const [assignments] = useState<ColorAssignments>(() => new Map());

	// oxlint-disable-next-line studio/no-manual-memo -- React Compiler skips the component without it
	const { plotted, discrete } = useMemo(() => {
		const lines = bindings.filter((binding) => graphSection(binding.role) !== 'discrete');
		return { plotted: lines, discrete: bindings.filter((binding) => graphSection(binding.role) === 'discrete') };
	}, [bindings]);
	const units = seriesUnits(plotted);
	const series = plotted.flatMap((binding, index): PlotSeries[] =>
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
	);
	const bandEntries = discrete.map((binding) => binding.entry);
	const hasPlot = plotted.length > 0;
	const hasRight = series.some((line) => line.axis === 'y2');
	const insets = { left: hasPlot ? axisWidth : edgeInset, right: hasRight ? axisWidth : edgeInset };

	const plotRef = useRef<HTMLDivElement>(null);
	const bandsRef = useRef<HTMLCanvasElement>(null);
	const areaRef = useRef<HTMLDivElement>(null);
	const gapsRef = useRef<HTMLDivElement>(null);
	const cursorLineRef = useRef<HTMLDivElement>(null);
	const hoverLineRef = useRef<HTMLDivElement>(null);
	const hoverDeltaRef = useRef<HTMLDivElement>(null);
	const hoverDotsRef = useRef<HTMLDivElement>(null);
	// Refs never change, so drawing only starts over when the entries or palette do
	const elements: GraphElements = {
		plot: plotRef,
		bands: bandsRef,
		area: areaRef,
		gaps: gapsRef,
		cursorLine: cursorLineRef,
		hoverLine: hoverLineRef,
		hoverDelta: hoverDeltaRef,
		hoverDots: hoverDotsRef,
	};
	// Unit labels go above the y-axes
	const plotTop = units.axes.y === undefined && units.axes.y2 === undefined ? edgeInset : 20;
	// The timeline bar marks the time graphs show
	useGraphShown();
	const graph = useGraphDrawing(elements, series, bandEntries, bandPalette, assignments, plotTop);
	useWidgetMenu(() => ({
		actions: [
			{
				label: 'Reset view',
				onSelect: () => {
					graph.current.setManual('y');
					graph.current.setManual('y2');
					resetView();
				},
			},
		],
	}));
	const body = useRef<HTMLDivElement>(null!);
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
	// oxlint-disable-next-line studio/no-manual-memo -- Effects depend on it, and `react-hooks/exhaustive-deps` can't tell that React Compiler memoizes it
	const measureOrigin = useCallback(() => {
		if (!body.current.checkVisibility()) {
			setOrigin(undefined);
			return;
		}
		const { left, top, width } = body.current.getBoundingClientRect();
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
		observer.observe(body.current);
		return () => {
			stopped = true;
			observer.disconnect();
		};
	}, [measureOrigin, pinned]);

	return (
		<div {...stylex.props(styles.graph)}>
			<GraphLegend plotted={plotted} />
			<div
				ref={body}
				{...stylex.props(styles.body)}
				{...handlers}
				onPointerDownCapture={measureOrigin}
				onPointerMoveCapture={measureOrigin}
			>
				{hasPlot && (
					// Contained so uPlot resizing its elements, then measuring, doesn't lay out the whole page again every frame
					// while panes resize
					<div ref={plotRef} {...stylex.props(styles.plot)} />
				)}
				{hasPlot && <AxisUnit label={units.axes.y} side="left" />}
				{hasRight && <AxisUnit label={units.axes.y2} side="right" />}
				<div {...stylex.props(styles.bands)} style={{ height: discrete.length * rowHeight }}>
					{discrete.map((binding, row) => (
						<BandRow key={binding.id} binding={binding} row={row} insets={insets} />
					))}
					<canvas
						ref={bandsRef}
						// Canvases don't stretch between `left` and `right` like other elements, so set the width
						{...stylex.props(styles.bandsCanvas)}
						style={{
							left: insets.left,
							width: `calc(100% - ${insets.left + insets.right}px)`,
							height: discrete.length * rowHeight,
						}}
					/>
				</div>
				{!hasPlot && <div {...stylex.props(styles.spacer)} />}
				<GraphOverlay
					areaRef={areaRef}
					gapsRef={gapsRef}
					hoverLineRef={hoverLineRef}
					cursorLineRef={cursorLineRef}
					hoverDotsRef={hoverDotsRef}
					hoverDeltaRef={hoverDeltaRef}
					series={series}
					selection={selection}
					plotted={plotted}
					units={units.units}
					insets={insets}
					deltaHidden={!pointerAt || selection !== undefined}
					deltaBottom={(hasPlot ? discrete.length * rowHeight : 0) + 8}
				/>
				<GraphTooltip
					bandHover={bandHover}
					bandEntry={bandHover && discrete[bandHover.row]?.entry}
					palette={bandPalette}
					assignments={assignments}
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
