// Draws the plot, bands, and lines over them outside React, so zooming, scrubbing, and streaming don't re-render
import { type RefObject, useEffect, useRef } from 'react';
import type uPlot from 'uplot';
import { type Entry, getGaps, getTimeRange, subscribeData } from '@/data/data-store';
import type { Size } from '@/hooks/use-size';
import { settingsStore } from '@/settings';
import { getCursorTime, subscribeTimeline } from '@/timeline/timeline';
import { drawBands } from '@/widgets/graph/bands';
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
import { timeTicks } from '@/widgets/graph/ticks';
import { getHoverTime, subscribeHover } from '@/timeline/hover';
import { getViewRange, subscribeView } from '@/widgets/graph/view';

export type GraphElements = {
	/** Where uPlot draws, absent without plotted entries */
	plot: RefObject<HTMLDivElement | null>;
	bands: RefObject<HTMLCanvasElement | null>;
	/** Spans the plot and bands between the y-axes, holds the lines below */
	area: RefObject<HTMLDivElement | null>;
	cursorLine: RefObject<HTMLDivElement | null>;
	hoverLine: RefObject<HTMLDivElement | null>;
	/** One dot per plotted series where it crosses the hovered time */
	hoverDots: RefObject<HTMLDivElement | null>;
};

/** Run `callback` once per frame, no matter how many times the returned function is called */
function perFrame(callback: () => void): { schedule: () => void; cancel: () => void } {
	let frame: number | undefined;
	return {
		schedule: () => {
			frame ??= requestAnimationFrame(() => {
				frame = undefined;
				callback();
			});
		},
		cancel: () => {
			if (frame !== undefined) {
				cancelAnimationFrame(frame);
			}
		},
	};
}

function placeLine(
	line: HTMLDivElement,
	time: number | undefined,
	view: { start: number; end: number },
	width: number,
) {
	const visible = time !== undefined && time >= view.start && time <= view.end;
	line.hidden = !visible;
	if (visible) {
		line.style.transform = `translateX(${((time - view.start) / (view.end - view.start)) * width}px)`;
	}
}

/** The uPlot instance, for reading positions, and the y-axis ranges the user zoomed */
export type GraphPlot = {
	plot: uPlot | undefined;
	manual: ManualRanges;
	redraw: () => void;
	/** Fix a y-axis's range, or let every axis fit the data again with `undefined` */
	setManual: (axis: 'y' | 'y2' | undefined, range?: [number, number]) => void;
};

export function useGraphDrawing(
	elements: GraphElements,
	series: readonly PlotSeries[],
	bandEntries: readonly (Entry | undefined)[],
	palette: BandPalette,
	/** Room above the plot, ex. for unit labels */
	plotTop: number,
): RefObject<GraphPlot> {
	const state = useRef<GraphPlot>({
		plot: undefined,
		manual: {},
		redraw: () => {},
		setManual(axis, range) {
			this.manual = axis === undefined ? {} : { ...this.manual, [axis]: range };
			this.redraw();
		},
	});
	const assignments = useRef<ColorAssignments>(new Map());
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
			if (view === undefined) {
				return;
			}
			placeLine(elements.cursorLine.current!, getCursorTime(), view, width);
			const hover = getHoverTime();
			placeLine(elements.hoverLine.current!, hover, view, width);

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
					if (value !== undefined) {
						const top = plot.valToPos(value, line.axis) + plot.over.offsetTop;
						dot.style.transform = `translate(${plot.valToPos(hover!, 'x')}px, ${top}px)`;
					}
				}
			}
		};

		const lineFades = fades.current;
		updateFades(lineFades, series, performance.now());
		const fadeLines = (now: number): boolean => {
			let fading = false;
			for (const [index, line] of series.entries()) {
				const fade = lineFades.get(line.id)!;
				plot!.series[index + 1]!.alpha = opacityAt(fade, now);
				fading ||= isFading(fade, now);
			}
			return fading;
		};

		/** Hidden lines stay fitted while they fade out, so they don't move as their axis fits the others */
		const fitted = (now: number) => series.map((line) => !line.hidden || isFading(lineFades.get(line.id)!, now));
		let wasFading = false;

		let targets: YTargets = {};
		// Eases the y-axes and fades lines without working out the lines again, they're already in view
		const animate = perFrame(() => {
			if (plot) {
				const now = performance.now();
				const fading = fadeLines(now);
				let easing = false;
				plot.batch(() => {
					easing = setYRanges(plot, targets, current.manual, animations.current, now);
				});
				if (!fading && wasFading) {
					// Lines that faded out stop being fitted
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
					targets = drawPlot(plot, series, view, range.end, gaps, dots, fitted(now));
					if (setYRanges(plot, targets, current.manual, animations.current, now) || fading) {
						animate.schedule();
					}
				});
			}
			const canvas = elements.bands.current;
			if (canvas && bandEntries.length > 0) {
				drawBands(canvas, bandEntries, view, gaps, assignments.current, palette);
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

		full.schedule();
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
	}, [elements, series, bandEntries, palette, plotTop]);

	return state;
}
