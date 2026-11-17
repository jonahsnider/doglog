import { type MouseEvent, type PointerEvent, useEffect, useRef, useState } from 'react';
import { type Entry, getTimeRange, subscribeData, type TimeRange } from '@/data/data-store';
import { formatValue } from '@/data/format-value';
import { useSource } from '@/data/source';
import { formatTime, getCursorTime, seek, subscribeTimeline } from '@/timeline';
import { accentColor } from '@/theme-color';
import { useSettings } from '@/settings';
import {
	bandColor,
	bandPalette,
	bandTextColor,
	type BandPalette,
	type ColorAssignments,
} from '@/widgets/discrete-timeline-colors';
import { NoData } from '@/widgets/no-data';
import type { WidgetBinding, WidgetProps } from '@/widgets/widget-type';
import { EntryName } from '@/components/entry-name';
import { useBindingDrag } from '@/entry-drag';

/** Live sources show the newest 30 s, matching the line graph */
const liveWindow = 30_000_000;

// Layout (px): each row is a label above a band
const padding = 8;
const labelHeight = 16;
const bandTop = 18;
const bandHeight = 20;
const rowHeight = 44;

/** The time range shown: the whole source for logs, the newest data for live sources */
function visibleWindow(live: boolean): TimeRange | undefined {
	const range = getTimeRange();
	if (range === undefined) {
		return undefined;
	}
	const start = live ? Math.max(range.start, range.end - liveWindow) : range.start;
	// Avoid dividing by zero when the source has a single timestamp
	return { start, end: Math.max(range.end, start + 1) };
}

/** The period of unchanged value around `time`, or `undefined` before the first sample */
function bandAt(entry: Entry, time: number, end: number) {
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

function drawBands(
	canvas: HTMLCanvasElement,
	bindings: WidgetProps['bindings'],
	view: TimeRange | undefined,
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
	if (view === undefined) {
		return;
	}

	context.font = `500 11px ${getComputedStyle(canvas).fontFamily}`;
	context.textBaseline = 'middle';
	const toX = (time: number) => Math.round(((time - view.start) / (view.end - view.start)) * width);

	for (const [row, { entry }] of bindings.entries()) {
		if (!entry) {
			continue;
		}

		const { timestamps, values, length } = entry.samples;
		const y = row * rowHeight + bandTop - labelHeight;
		let index = Math.max(0, entry.samples.indexAtOrBefore(view.start));

		while (index < length && timestamps[index]! <= view.end) {
			const value = values[index];
			let next = index + 1;
			while (next < length && values[next] === value) {
				next++;
			}

			const x = toX(Math.max(timestamps[index]!, view.start));
			const bandWidth = toX(next < length ? timestamps[next]! : view.end) - x;
			context.fillStyle = bandColor(assignments, palette, entry, value);
			// A 1px gap separates neighboring bands, in case two values share a color
			context.fillRect(x, y, bandWidth > 2 ? bandWidth - 1 : Math.max(bandWidth, 1), bandHeight);

			if (bandWidth > 24) {
				const text = formatValue(value);
				if (context.measureText(text).width + 8 <= bandWidth) {
					context.fillStyle = bandTextColor;
					context.fillText(text, x + 4, y + bandHeight / 2);
				}
			}

			index = next;
		}
	}
}

/** Run `callback` once after the current task, no matter how many times the returned function is called */
function batched(callback: () => void): () => void {
	let pending = false;
	return () => {
		if (!pending) {
			pending = true;
			queueMicrotask(() => {
				pending = false;
				callback();
			});
		}
	};
}

/** Time under the pointer `x` px into a band `width` px wide */
function timeAt(x: number, width: number, live: boolean): number | undefined {
	const view = visibleWindow(live);
	return view && width > 0 ? view.start + (x / width) * (view.end - view.start) : undefined;
}

type Hover = { x: number; width: number; row: number };

export function DiscreteTimeline({ bindings }: WidgetProps) {
	const live = useSource()?.type === 'live';
	const container = useRef<HTMLDivElement>(null);
	const canvas = useRef<HTMLCanvasElement>(null);
	const cursorLine = useRef<HTMLDivElement>(null);
	const assignments = useRef<ColorAssignments>(new Map());
	const [hover, setHover] = useState<Hover>();
	const { themePreset, themeColor } = useSettings();
	const accent = accentColor(themePreset, themeColor);

	useEffect(() => {
		const updateCursor = () => {
			const time = getCursorTime();
			const view = visibleWindow(live);
			const line = cursorLine.current!;
			if (time === undefined || view === undefined || time < view.start || time > view.end) {
				line.hidden = true;
				return;
			}
			line.hidden = false;
			const x = ((time - view.start) / (view.end - view.start)) * canvas.current!.clientWidth;
			line.style.transform = `translateX(${x}px)`;
		};

		const palette = bandPalette(accent);
		// Bands only change with data, size, or theme, cursor moves just move the line
		const scheduleDraw = batched(() => {
			drawBands(canvas.current!, bindings, visibleWindow(live), assignments.current, palette);
			updateCursor();
		});

		scheduleDraw();
		const unsubscribeData = subscribeData(scheduleDraw);
		const unsubscribeTimeline = subscribeTimeline(updateCursor);
		const observer = new ResizeObserver(scheduleDraw);
		observer.observe(canvas.current!);
		return () => {
			unsubscribeData();
			unsubscribeTimeline();
			observer.disconnect();
		};
	}, [accent, bindings, live]);

	const handlePointerMove = (event: PointerEvent) => {
		const rect = canvas.current!.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const row = Math.floor((event.clientY - container.current!.getBoundingClientRect().top - padding) / rowHeight);
		setHover(
			x >= 0 && x <= rect.width && row >= 0 && row < bindings.length ? { x, width: rect.width, row } : undefined,
		);
	};

	const handleClick = (event: MouseEvent) => {
		const rect = canvas.current!.getBoundingClientRect();
		const time = timeAt(event.clientX - rect.left, rect.width, live);
		if (time !== undefined) {
			seek(time);
		}
	};

	let tooltip;
	const hoverEntry = hover && bindings[hover.row]?.entry;
	const hoverTime = hover && timeAt(hover.x, hover.width, live);
	const range = getTimeRange();
	if (hover && hoverEntry && hoverTime !== undefined && range) {
		const band = bandAt(hoverEntry, hoverTime, range.end);
		if (band) {
			const flip = hover.x > hover.width / 2;
			tooltip = (
				<div
					className="pointer-events-none absolute z-10 rounded-md border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow-md"
					style={{
						left: padding + hover.x + (flip ? -8 : 8),
						top: padding + hover.row * rowHeight + bandTop + bandHeight + 4,
						transform: flip ? 'translateX(-100%)' : undefined,
					}}
				>
					<div className="font-mono font-medium">{formatValue(band.value)}</div>
					<div className="text-muted-foreground tabular-nums">
						{formatTime(band.start, range.start)} - {formatTime(band.end, range.start)}
					</div>
				</div>
			);
		}
	}

	return (
		// Clicking to seek is a pointer shortcut, keyboard users seek with the timeline bar
		// oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, react-doctor/click-events-have-key-events, react-doctor/no-static-element-interactions
		<div
			ref={container}
			className="relative cursor-crosshair"
			style={{ height: bindings.length * rowHeight + padding * 2 }}
			onPointerMove={handlePointerMove}
			onPointerLeave={() => setHover(undefined)}
			onClick={handleClick}
		>
			{bindings.map((binding, row) => (
				<TimelineRow key={binding.id} binding={binding} missing={!binding.entry} row={row} />
			))}
			<canvas
				ref={canvas}
				// Canvases don't stretch between `left` and `right` like other elements, so set the width
				className="pointer-events-none absolute left-2 w-[calc(100%-1rem)]"
				style={{ top: padding + labelHeight, height: bindings.length * rowHeight - labelHeight }}
			/>
			<div ref={cursorLine} hidden className="pointer-events-none absolute inset-y-0 left-2 w-px bg-foreground" />
			{tooltip}
		</div>
	);
}

function TimelineRow({ binding, missing, row }: { binding: WidgetBinding; missing: boolean; row: number }) {
	const { ref, handleRef } = useBindingDrag(binding);
	return (
		<div
			ref={ref}
			className="absolute inset-x-2 text-xs"
			style={{ top: padding + row * rowHeight, height: rowHeight }}
			// Right-clicking the row offers to remove its binding, middle-clicking removes it
			data-binding-id={binding.id}
		>
			{/* Dragged by the name, clicking the band seeks */}
			<div ref={handleRef} className="w-fit max-w-full cursor-grab truncate font-mono leading-4 text-muted-foreground">
				<EntryName name={binding.name} />
			</div>
			{missing && (
				<div className="flex items-center" style={{ height: bandHeight, marginTop: bandTop - labelHeight }}>
					<NoData />
				</div>
			)}
		</div>
	);
}
