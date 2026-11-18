import { useHotkeys } from '@tanstack/react-hotkeys';
import { type PointerEvent, useMemo, useRef, useState } from 'react';
import { useEventListener } from 'usehooks-ts';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { alertColors, modeColors } from '@/timeline/colors';
import { HoverTooltip } from '@/timeline/timeline-tooltip';
import { setHoverTime, useHoverTime } from '@/timeline/hover';
import { useZoomedRange } from '@/widgets/graph/view';
import { type TimeRange, useEntries } from '@/data/data-store';
import { cn } from '@/lib/utils';
import { settingsStore } from '@/settings';
import { formatTime, getCursorTime, seek, seekHotkeys } from '@/timeline/timeline';
import { getAlertSpans, getCompressedSpans, getModePeriods } from '@/timeline/events';
import { createTimeScale } from '@/timeline/scale';

/**
 * Live sources are shown at least one FRC match long (2026: 20 s auto, 2 min 20 s teleop),
 * so the timeline doesn't rescale every frame right after connecting
 */
const minLiveDuration = 160_000_000;

/** How close (px) the pointer has to be to an alert to show it, so short alerts are easy to hover */
const alertHoverSlop = 4;

/** Pointer position along the track and the track's width (px) */
type Hover = { x: number; width: number };

/** How close (px) the pointer has to be to the start of a section, ex. the start of auto, to snap to it */
const snapDistance = 6;

/** Drag, click, or scroll horizontally to move the cursor. Shows the robot's mode and alerts along the track. */
export function Scrubber({
	range,
	time,
	live,
	showAlerts,
	compress,
}: {
	range: TimeRange;
	time: number;
	live: boolean;
	showAlerts: boolean;
	/** Whether long disabled spans are compressed */
	compress: boolean;
}) {
	// Non-null so it matches the React 18 `RefObject` that usehooks-ts' `useEventListener` expects
	const slider = useRef<HTMLDivElement>(null!);
	const track = useRef<HTMLDivElement>(null);
	// Hotkeys skip the arrow, Home, and End keys a focused slider uses itself, so they're given to the slider directly
	useHotkeys(seekHotkeys, { target: slider });
	const [hover, setHover] = useState<Hover>();
	const entries = useEntries();
	const duration = range.end - range.start;
	// The time shown across the whole track, longer than the data for short live sessions
	const shownDuration = live ? Math.max(duration, minLiveDuration) : duration;

	// The range changes whenever data does
	const periods = useMemo(() => getModePeriods(range), [range]);
	const compressed = useMemo(
		() => (compress ? getCompressedSpans(periods, range, live) : []),
		[compress, periods, range, live],
	);
	const scale = useMemo(
		() => createTimeScale(range.start, shownDuration, compressed),
		[range.start, shownDuration, compressed],
	);
	const { toPercent } = scale;
	// Errors are drawn last so they're on top of warnings
	const alerts = useMemo(
		() =>
			showAlerts
				? getAlertSpans(entries, range).toSorted((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? 1 : -1))
				: [],
		[entries, range, showAlerts],
	);

	const hoverAt = (event: PointerEvent): Hover => {
		const rect = track.current!.getBoundingClientRect();
		return { x: Math.min(Math.max(event.clientX - rect.left, 0), rect.width), width: rect.width };
	};
	/** The time under the pointer, snapped to the start of a section when it's close */
	const timeAt = ({ x, width }: Hover) => {
		const pointerPercent = (x / width) * 100;
		const snapPercent = (snapDistance / width) * 100;
		const distance = (start: number) => Math.abs(toPercent(start) - pointerPercent);
		const nearest = periods
			.map((period) => period.start)
			.reduce<number | undefined>(
				(best, start) =>
					distance(start) <= snapPercent && (best === undefined || distance(start) < distance(best)) ? start : best,
				undefined,
			);
		return nearest ?? scale.toTime(pointerPercent);
	};
	const seekToPointer = (event: PointerEvent) => {
		seek(timeAt(hoverAt(event)));
	};

	/** The tooltip for the pointer `x` px into the track, `undefined` if nothing is known there, ex. before Driver Station data */
	const tooltipAt = (at: Hover) => {
		const hoverTime = timeAt(at);
		const slopPercent = (alertHoverSlop / at.width) * 100;
		const from = scale.toTime(toPercent(hoverTime) - slopPercent);
		const to = scale.toTime(toPercent(hoverTime) + slopPercent);
		// Sections share their boundaries, the later one starts there
		const period = periods.findLast((item) => item.start <= hoverTime && hoverTime <= item.end);
		const hovered = alerts
			.filter((alert) => alert.start <= to && from <= alert.end)
			.toSorted((a, b) => a.start - b.start);
		return period !== undefined || hovered.length > 0 ? (
			<HoverTooltip
				period={period}
				compressed={compressed.some((span) => span.start <= hoverTime && hoverTime <= span.end)}
				alerts={hovered}
				hoverTime={hoverTime}
				start={range.start}
			/>
		) : undefined;
	};
	const tooltip = hover === undefined ? undefined : tooltipAt(hover);
	// Where the tooltip was last shown, so it keeps its contents while fading out instead of shrinking to nothing
	const [shownHover, setShownHover] = useState<Hover>();
	if (hover !== undefined && tooltip !== undefined && (hover.x !== shownHover?.x || hover.width !== shownHover.width)) {
		setShownHover(hover);
	}

	// Scrolling moves the cursor like dragging it would, following the fingers whichever way the system scrolls.
	// Natural scrolling inverts the delta, WebKit reports when it does and other browsers rely on the setting.
	// Not passive so it can stop the browser from treating a horizontal swipe as back or forward.
	useEventListener(
		'wheel',
		(event) => {
			const cursor = getCursorTime();
			if (event.deltaX === 0 || cursor === undefined) {
				return;
			}
			event.preventDefault();
			const natural =
				(event as WheelEvent & { webkitDirectionInvertedFromDevice?: boolean }).webkitDirectionInvertedFromDevice ??
				settingsStore.get().naturalScrolling;
			const delta = natural ? -event.deltaX : event.deltaX;
			seek(scale.toTime(toPercent(cursor) + (delta / track.current!.clientWidth) * 100));
		},
		slider,
		{ passive: false },
	);

	const cursorPercent = toPercent(time);

	return (
		<div
			ref={slider}
			role="slider"
			tabIndex={0}
			aria-label="Time"
			aria-valuemin={0}
			aria-valuemax={duration / 1_000_000}
			aria-valuenow={(time - range.start) / 1_000_000}
			aria-valuetext={formatTime(time, range.start)}
			className="group flex h-full min-w-0 flex-1 cursor-pointer touch-none items-center px-2 outline-none select-none"
			onPointerDown={(event) => {
				if (event.button === 0) {
					// WebKit starts a text selection when dragging out of the slider despite `select-none`.
					// Preventing that also prevents focusing, so the slider is focused manually.
					event.preventDefault();
					event.currentTarget.focus();
					event.currentTarget.setPointerCapture(event.pointerId);
					seekToPointer(event);
				}
			}}
			onPointerMove={(event) => {
				const at = hoverAt(event);
				setHover(at);
				setHoverTime(timeAt(at));
				if (event.currentTarget.hasPointerCapture(event.pointerId)) {
					seekToPointer(event);
				}
			}}
			onPointerLeave={() => {
				setHover(undefined);
				setHoverTime(undefined);
			}}
		>
			<Tooltip open={tooltip !== undefined} trackCursorAxis="x" disableHoverablePopup>
				<TooltipTrigger
					// The slider handles focus and keyboard input, the tooltip is only for pointers
					render={<div ref={track} tabIndex={-1} className="relative h-6 w-full" />}
				>
					{/* When alerts were active, above the track. Short alerts are drawn as dots. */}
					{alerts.map((alert) => (
						<div
							key={`${alert.start}:${alert.level}:${alert.text}`}
							className={cn('absolute top-0 h-1.5 rounded-full', alertColors[alert.level])}
							style={{
								left: `${toPercent(alert.start)}%`,
								width: `max(0.375rem, ${toPercent(alert.end) - toPercent(alert.start)}%)`,
							}}
						/>
					))}

					{/* The track, colored by the robot's mode. Past the newest live data it's fainter. Centered without alerts above it. */}
					<div
						className={cn(
							'absolute inset-x-0 h-2 overflow-hidden rounded-full bg-input/40',
							showAlerts ? 'bottom-1' : 'top-1/2 -translate-y-1/2',
						)}
					>
						<div className="absolute inset-y-0 left-0 bg-input" style={{ width: `${toPercent(range.end)}%` }} />
						{periods.length === 0 ? (
							// Without mode data, show how much has played
							<div className="absolute inset-y-0 left-0 bg-primary" style={{ width: `${cursorPercent}%` }} />
						) : (
							periods.map((period) => {
								const color = modeColors[period.mode];
								return color === undefined ? null : (
									<div
										key={period.start}
										className={cn('absolute inset-y-0', color)}
										style={{
											left: `${toPercent(period.start)}%`,
											width: `${toPercent(period.end) - toPercent(period.start)}%`,
										}}
									/>
								);
							})
						)}
						{/* Compressed spans are hatched so it's clear they aren't to scale */}
						{compressed.map((span) => (
							<div
								key={span.start}
								className="absolute inset-y-0 bg-background bg-[image:repeating-linear-gradient(-45deg,var(--color-input)_0_2px,transparent_2px_4px)]"
								style={{ left: `${toPercent(span.start)}%`, width: `${toPercent(span.end) - toPercent(span.start)}%` }}
							/>
						))}
					</div>

					<GraphMarks toPercent={toPercent} hoverTime={hover === undefined ? undefined : timeAt(hover)} />

					<div
						className={cn(
							'absolute size-3.5 -translate-x-1/2 rounded-full border-2 border-primary bg-background group-focus-visible:ring-[3px] group-focus-visible:ring-ring/48',
							showAlerts ? 'bottom-2 translate-y-1/2' : 'top-1/2 -translate-y-1/2',
						)}
						style={{ left: `${cursorPercent}%` }}
					/>
				</TooltipTrigger>
				<TooltipPopup>{tooltip ?? (shownHover && tooltipAt(shownHover))}</TooltipPopup>
			</Tooltip>
		</div>
	);
}

/**
 * The time range graphs are zoomed to, so it's clear where they are in the whole source, and the hovered time: the one
 * the tooltip is about, or the one hovered in a graph
 */
function GraphMarks({ toPercent, hoverTime }: { toPercent: (time: number) => number; hoverTime: number | undefined }) {
	const zoomed = useZoomedRange();
	const graphHover = useHoverTime();
	const hover = hoverTime ?? graphHover;
	return (
		<>
			{zoomed && (
				<div
					className="pointer-events-none absolute inset-y-0 rounded-sm bg-foreground/8 ring-1 ring-foreground/24 ring-inset"
					style={{ left: `${toPercent(zoomed.start)}%`, width: `${toPercent(zoomed.end) - toPercent(zoomed.start)}%` }}
				/>
			)}
			{hover !== undefined && (
				<div
					className="absolute inset-y-0 w-px -translate-x-1/2 bg-foreground/48"
					style={{ left: `${toPercent(hover)}%` }}
				/>
			)}
		</>
	);
}
