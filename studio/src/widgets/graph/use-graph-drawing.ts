// Draws the plot, bands, and lines over them outside React, so zooming, scrubbing, and streaming don't re-render
import { type RefObject, useEffect, useRef } from 'react';
import type uPlot from 'uplot';
import { type Entry, getGaps, getTimeRange, subscribeData } from '@/data/data-store';
import type { Size } from '@/hooks/use-size';
import { settingsStore } from '@/settings';
import { formatDuration } from '@/timeline/format-time';
import { getCursorTime, subscribeTimeline } from '@/timeline/timeline';
import { drawBands, placeGaps } from '@/widgets/graph/bands';
import type { BandPalette, ColorAssignments } from '@/widgets/graph/colors';
import {
	createPlot,
	drawPlot,
	type ManualRanges,
	type PlotSeries,
	setYRanges,
	type YTargets,
} from '@/widgets/graph/plot';
import { createRangeAnimation } from '@/widgets/graph/y-range';
import { type Fade, isFading, opacityAt, updateFades } from '@/widgets/graph/fade';
import { perFrame } from '@/lib/per-frame';
import { timeTicks } from '@/widgets/graph/ticks';
import { getHoverTime, subscribeHover } from '@/timeline/hover';
import { getViewRange, subscribeView } from '@/widgets/graph/view';

export type GraphElements = {
	/** Where uPlot draws, absent without plotted entries */
	plot: RefObject<HTMLDivElement | null>;
	bands: RefObject<HTMLCanvasElement | null>;
	/** Spans the plot and bands between the y-axes, holds the lines below */
	area: RefObject<HTMLDivElement | null>;
	gaps: RefObject<HTMLDivElement | null>;
	cursorLine: RefObject<HTMLDivElement | null>;
	hoverLine: RefObject<HTMLDivElement | null>;
	hoverDelta: RefObject<HTMLDivElement | null>;
	/** One dot per plotted series where it crosses the hovered time */
	hoverDots: RefObject<HTMLDivElement | null>;
};

function placeLine(
	line: HTMLDivElement,
	time: number | undefined,
	view: { start: number; end: number },
	width: number,
): number | undefined {
	const visible = time !== undefined && time >= view.start && time <= view.end;
	line.hidden = !visible;
	if (!visible) {
		return undefined;
	}
	const x = ((time - view.start) / (view.end - view.start)) * width;
	line.style.transform = `translateX(${x}px)`;
	return x;
}

/** The uPlot instance, for reading positions, the ranges that fit the data in view, and the ones the user fixed by zooming */
export type GraphPlot = {
	plot: uPlot | undefined;
	targets: YTargets;
	manual: ManualRanges;
	redraw: () => void;
	setManual: (axis: 'y' | 'y2', range?: [number, number]) => void;
	/** Mutes the other bindings' lines to pick out this one's, or shows them all again without one */
	highlight: (bindingId: string | undefined) => void;
};

export function useGraphDrawing(
	elements: GraphElements,
	series: readonly PlotSeries[],
	bandEntries: readonly (Entry | undefined)[],
	palette: BandPalette,
	assignments: ColorAssignments,
	/** Room above the plot, ex. for unit labels */
	plotTop: number,
): RefObject<GraphPlot> {
	// Kept while the plot is made again for other entries, so lines stay muted, ex. when another entry is added
	const highlighted = useRef<string>(undefined);
	const state = useRef<GraphPlot>({
		plot: undefined,
		targets: {},
		manual: {},
		redraw: () => {},
		setManual(axis, range) {
			state.current.manual = { ...state.current.manual, [axis]: range };
			state.current.redraw();
		},
		highlight(bindingId) {
			highlighted.current = bindingId;
			state.current.redraw();
		},
	});
	// Kept while the plot is made again for other entries, so axes and lines ease from how they were drawn, ex. when one is hidden
	const animations = useRef({ y: createRangeAnimation(), y2: createRangeAnimation() });
	const fades = useRef(new Map<string, Fade>());

	useEffect(() => {
		const current = state.current;
		const area = elements.area.current!;
		const plotTarget = elements.plot.current;
		const dots = { current: [] as number[][] };
		const plot =
			plotTarget && series.length > 0
				? createPlot(
						plotTarget,
						series,
						{ width: plotTarget.clientWidth, height: plotTarget.clientHeight },
						() => {
							const view = getViewRange();
							const range = getTimeRange();
							return view && range ? timeTicks(view, range.start, area.clientWidth).times : [];
						},
						plotTop,
						dots,
					)
				: undefined;
		current.plot = plot;

		let drawnView = '';
		const drawOverlays = () => {
			const view = getViewRange();
			const width = area.clientWidth;
			const ruler = elements.hoverDelta.current!;
			if (view === undefined) {
				ruler.hidden = true;
				return;
			}
			placeGaps(elements.gaps.current!, getGaps(), view, width);
			const cursor = getCursorTime();
			const hover = getHoverTime();
			const cursorX = placeLine(elements.cursorLine.current!, cursor, view, width);
			const hoverX = placeLine(elements.hoverLine.current!, hover, view, width);
			if (cursor === undefined || hoverX === undefined || cursorX === hoverX) {
				ruler.hidden = true;
			} else {
				// A cursor out of view leaves the bracket open at the edge it's past
				const startX = cursorX ?? (cursor < view.start ? 0 : width);
				const center = (startX + hoverX) / 2;
				const delta = hover! - cursor;
				ruler.hidden = false;
				ruler.style.left = `${Math.min(startX, hoverX)}px`;
				ruler.style.width = `${Math.abs(hoverX - startX)}px`;
				ruler.style.setProperty('--delta-left-stroke', cursorX === undefined && startX === 0 ? '0px' : '2px');
				ruler.style.setProperty('--delta-right-stroke', cursorX === undefined && startX === width ? '0px' : '2px');
				// Keep a gap from the y-axis at either edge, even when the interval is narrower than its label.
				const inset = 4;
				ruler.style.setProperty(
					'--delta-label-shift',
					`clamp(${inset - center}px, -50%, calc(${width - inset - center}px - 100%))`,
				);
				ruler.firstElementChild!.textContent = `${delta < 0 ? '−' : '+'}${formatDuration(Math.abs(delta))}`;
			}

			const dotsElement = elements.hoverDots.current;
			if (dotsElement && plot) {
				const visible = hover !== undefined && hover >= view.start && hover <= view.end;
				for (const [index, line] of series.entries()) {
					const dot = dotsElement.children[index];
					const logged = visible && !line.hidden ? line.entry.samples.valueAt(hover) : undefined;
					const value = typeof logged === 'number' ? line.convert(logged) : undefined;
					if (!(dot instanceof HTMLElement)) {
						continue;
					}
					dot.hidden = value === undefined;
					dot.style.opacity = String(plot.series[index + 1]!.alpha ?? 1);
					if (value !== undefined) {
						const top = plot.valToPos(value, line.axis) + plot.over.offsetTop;
						dot.style.transform = `translate(${plot.valToPos(hover!, 'x')}px, ${top}px)`;
					}
				}
			}
		};

		const lineFades = fades.current;
		const fadeLines = (now: number): boolean => {
			updateFades(lineFades, series, highlighted.current, now);
			let fading = false;
			for (const [index, line] of series.entries()) {
				const fade = lineFades.get(line.id)!;
				plot!.series[index + 1]!.alpha = opacityAt(fade, now);
				fading = isFading(fade, now) || fading;
			}
			return fading;
		};

		/** Hidden lines stay fitted while they fade out, so they don't move as their axis fits the others */
		const fitted = (now: number) => series.map((line) => !line.hidden || isFading(lineFades.get(line.id)!, now));
		let wasFading = false;

		const animate = perFrame(() => {
			if (plot) {
				const now = performance.now();
				const fading = fadeLines(now);
				let easing = false;
				plot.batch(() => {
					easing = setYRanges(plot, current.targets, current.manual, animations.current, now);
					// uPlot's faceted line paths otherwise stay cached when only y2 changes.
					plot.redraw(true);
				});
				if (!fading && wasFading) {
					full.schedule();
				}
				wasFading = fading;
				if (fading || easing) {
					animate.schedule();
				}
			}
			drawOverlays();
		});

		const draw = (size?: Size) => {
			const view = getViewRange();
			const range = getTimeRange();
			if (view === undefined || range === undefined) {
				if (size) {
					plot?.setSize(size);
				}
				return;
			}
			drawnView = `${view.start}:${view.end}`;
			const gaps = getGaps();
			if (plot) {
				const now = performance.now();
				const fading = fadeLines(now);
				wasFading = fading;
				plot.batch(() => {
					if (size) {
						plot.setSize(size);
					}
					current.targets = drawPlot(plot, series, view, range.end, gaps, dots, fitted(now));
					if (setYRanges(plot, current.targets, current.manual, animations.current, now) || fading) {
						animate.schedule();
					}
				});
			}
			const canvas = elements.bands.current;
			if (canvas && bandEntries.length > 0) {
				drawBands(canvas, bandEntries, view, gaps, assignments, palette);
			}
			drawOverlays();
		};
		const full = perFrame(draw);
		const overlays = perFrame(() => {
			// The view changes with the cursor while following live data
			const view = getViewRange();
			if (view && `${view.start}:${view.end}` !== drawnView) {
				draw();
			} else {
				drawOverlays();
			}
		});
		current.redraw = full.schedule;

		// Draw with the data already available. A later entry update can replace this plot before the next frame.
		draw();
		const unsubscribeData = subscribeData(full.schedule);
		const unsubscribeTimeline = subscribeTimeline(overlays.schedule);
		const unsubscribeView = subscribeView(overlays.schedule);
		const unsubscribeHover = subscribeHover(overlays.schedule);
		// Colors are read from CSS each time the plot is drawn, so theme changes only need a redraw
		const settings = settingsStore.subscribe(full.schedule);
		let width = area.clientWidth;
		const observer = new ResizeObserver(() => {
			const size = plotTarget && { width: plotTarget.clientWidth, height: plotTarget.clientHeight };
			const resized = size && plot && (size.width !== plot.width || size.height !== plot.height) ? size : undefined;
			const nextWidth = area.clientWidth;
			if (nextWidth !== width || (resized && resized.width !== plot?.width)) {
				width = nextWidth;
				// Update size and re-sample at that width before the browser paints, not on the next frame.
				draw(resized);
			} else if (plot && resized) {
				// A height change doesn't affect which samples are drawn or where the bands change.
				plot.batch(() => plot.setSize(resized));
				drawOverlays();
			}
		});
		observer.observe(area);
		if (plotTarget) {
			observer.observe(plotTarget);
		}

		return () => {
			full.cancel();
			overlays.cancel();
			animate.cancel();
			unsubscribeData();
			unsubscribeTimeline();
			unsubscribeView();
			unsubscribeHover();
			settings.unsubscribe();
			observer.disconnect();
			plot?.destroy();
			current.plot = undefined;
		};
	}, [elements, series, bandEntries, palette, assignments, plotTop]);

	return state;
}
