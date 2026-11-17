import { useHotkeys } from '@tanstack/react-hotkeys';
import { type PointerEvent, useMemo, useRef, useState } from 'react';
import { useEventListener } from 'usehooks-ts';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { alertColors, modeColors } from '@/components/timeline-colors';
import { HoverTooltip } from '@/components/timeline-tooltip';
import { type TimeRange, useEntries } from '@/data/data-store';
import { cn } from '@/lib/utils';
import { formatTime, getCursorTime, seek, seekHotkeys } from '@/timeline';
import { getAlertSpans, getModePeriods } from '@/timeline-events';

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
}: {
	range: TimeRange;
	time: number;
	live: boolean;
	showAlerts: boolean;
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
	const toPercent = (value: number) => (shownDuration > 0 ? ((value - range.start) / shownDuration) * 100 : 100);

	// The range changes whenever data does
	const periods = useMemo(() => getModePeriods(range), [range]);
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
		const pointerTime = range.start + (x / width) * shownDuration;
		const snapTime = (snapDistance / width) * shownDuration;
		const nearest = periods
			.map((period) => period.start)
			.reduce<number | undefined>(
				(best, start) =>
					Math.abs(start - pointerTime) <= snapTime &&
					(best === undefined || Math.abs(start - pointerTime) < Math.abs(best - pointerTime))
						? start
						: best,
				undefined,
			);
		return nearest ?? pointerTime;
	};
	const seekToPointer = (event: PointerEvent) => {
		seek(timeAt(hoverAt(event)));
	};

	/** The tooltip for the pointer `x` px into the track, `undefined` if nothing is known there, ex. before Driver Station data */
	const tooltipAt = (at: Hover) => {
		const hoverTime = timeAt(at);
		const slop = (alertHoverSlop / at.width) * shownDuration;
		// Sections share their boundaries, the later one starts there
		const period = periods.findLast((item) => item.start <= hoverTime && hoverTime <= item.end);
		const hovered = alerts
			.filter((alert) => alert.start - slop <= hoverTime && hoverTime <= alert.end + slop)
			.toSorted((a, b) => a.start - b.start);
		return period !== undefined || hovered.length > 0 ? (
			<HoverTooltip period={period} alerts={hovered} hoverTime={hoverTime} start={range.start} />
		) : undefined;
	};
	const tooltip = hover === undefined ? undefined : tooltipAt(hover);
	// Where the tooltip was last shown, so it keeps its contents while fading out instead of shrinking to nothing
	const [shownHover, setShownHover] = useState<Hover>();
	if (hover !== undefined && tooltip !== undefined && (hover.x !== shownHover?.x || hover.width !== shownHover.width)) {
		setShownHover(hover);
	}

	// Scrolling moves the cursor as far as dragging the same distance would.
	// Not passive so it can stop the browser from treating a horizontal swipe as back or forward.
	useEventListener(
		'wheel',
		(event) => {
			const cursor = getCursorTime();
			if (event.deltaX === 0 || cursor === undefined) {
				return;
			}
			event.preventDefault();
			seek(cursor + (event.deltaX / track.current!.clientWidth) * shownDuration);
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
				setHover(hoverAt(event));
				if (event.currentTarget.hasPointerCapture(event.pointerId)) {
					seekToPointer(event);
				}
			}}
			onPointerLeave={() => setHover(undefined)}
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
					</div>

					{/* Shows exactly which time the tooltip is about */}
					{hover !== undefined && (
						<div
							className="absolute inset-y-0 w-px -translate-x-1/2 bg-foreground/48"
							style={{ left: `${toPercent(timeAt(hover))}%` }}
						/>
					)}

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
