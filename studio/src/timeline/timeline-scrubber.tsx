// oxlint-disable studio/no-manual-memo -- React Compiler skips Scrubber without `compressed`, and doesn't memoize the others on its own
import { colorVars, durationVars, easeVars, radiusVars, spacingVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { useHotkeys } from '@tanstack/react-hotkeys';
import { type PointerEvent, use, useMemo, useRef, useState } from 'react';
import { useEventListener } from 'usehooks-ts';
import { alertFills } from '@/timeline/colors';
import { HoverTooltip, ScrubberTooltip, UnreadTooltip } from '@/timeline/timeline-tooltip';
import { setHoverTime } from '@/timeline/hover';
import { GraphMarks, ScrubberPosition } from '@/timeline/timeline-marks';
import { ScrubberBar } from '@/timeline/scrubber-bar';
import { getGaps, type SourcesRange, useEntries } from '@/data/data-store';
import type { UnreadEnd } from '@/data/log-source';
import { settingsStore } from '@/settings';
import { formatTime, getCursorTime, seek, TimelineCursorContext } from '@/timeline/timeline';
import { seekHotkeys } from '@/timeline/seek';
import { getAlertSpans, getCompressedSpans, getModePeriods } from '@/timeline/events';
import { getActiveShifts } from '@/timeline/shifts';
import { createTimeScale } from '@/timeline/scale';
import { scrubberMarker } from './markers.stylex';

const styles = stylex.create({
	slider: {
		display: 'flex',
		flex: 1,
		alignItems: 'center',
		height: '100%',
		minWidth: 0,
		paddingInline: spacingVars['--spacing-2'],
		cursor: 'pointer',
		touchAction: 'none',
		userSelect: 'none',
		outline: 'none',
	},
	// `--track-offset` moves the track, and the marks centered on it, away from the alerts above it and the shifts below it
	track: {
		position: 'relative',
		width: '100%',
		height: '1.5rem',
		'--track-offset': '-50%',
	},
	lowered: { '--track-offset': 'calc(-50% + 0.25rem)' },
	raised: { '--track-offset': 'calc(-50% - 0.25rem)' },
	alert: {
		position: 'absolute',
		top: 0,
		height: 6,
		borderRadius: radiusVars['--radius-full'],
	},
	shift: {
		position: 'absolute',
		bottom: 0,
		height: 6,
		paddingInline: 1,
	},
	shiftFill: {
		width: '100%',
		height: '100%',
		borderRadius: radiusVars['--radius-full'],
		backgroundColor: 'var(--fuel)',
		boxShadow: 'inset 0 0 0 1px var(--fuel-outline)',
	},
	playhead: {
		position: 'absolute',
		top: '50%',
		width: 14,
		height: 14,
		borderWidth: 2,
		borderStyle: 'solid',
		borderColor: colorVars['--color-accent'],
		borderRadius: radiusVars['--radius-full'],
		backgroundColor: colorVars['--color-background-surface'],
		boxShadow: {
			default: null,
			[stylex.when.ancestor(':focus-visible', scrubberMarker)]: '0 0 0 3px var(--focus-outline-color)',
		},
		translate: '-50% var(--track-offset)',
		transitionProperty: 'translate',
		transitionDuration: `calc(${durationVars['--duration-fast']} * var(--motion-scale))`,
		transitionTimingFunction: easeVars['--ease-move'],
	},
});

/**
 * Live sources are shown at least one FRC match long (2026: 20 s auto, 2 min 20 s teleop),
 * so the timeline doesn't rescale every frame right after connecting
 */
const minLiveDuration = 160_000_000;

/** How close (px) the pointer has to be to an alert to show it, so short alerts are easy to hover */
const alertHoverSlop = 4;

/** How far (µs) scrolling one pixel moves the cursor, under a robot loop so each frame can be reached */
const scrollTimePerPixel = 15_000;

/** Pointer position along the track and the track's width (px) */
type Hover = { x: number; width: number };

/** How close (px) the pointer has to be to the start of a section, ex. the start of auto, to snap to it */
const snapDistance = 6;

export function Scrubber({
	range,
	live,
	showAlerts,
	showShifts,
	compress,
	year,
	unread,
}: {
	range: SourcesRange;
	live: boolean;
	showAlerts: boolean;
	showShifts: boolean;
	compress: boolean;
	/** The year the source is from, hub shifts are only known for 2026 */
	year: number | undefined;
	/** The end of a log's file that couldn't be read, shown after the data for about as long as it would have lasted */
	unread: UnreadEnd | undefined;
}) {
	const slider = useRef<HTMLDivElement>(null!);
	const track = useRef<HTMLDivElement>(null);
	// Hotkeys skip the arrow, Home, and End keys a focused slider uses itself, so they're given to the slider directly
	useHotkeys(seekHotkeys, { target: slider });
	const [hover, setHover] = useState<Hover>();
	const entries = useEntries();
	const duration = range.end - range.start;
	// The time shown across the whole track, longer than the data for short live sessions and logs with an unreadable end
	const shownDuration = live ? Math.max(duration, minLiveDuration) : duration + (unread?.duration ?? 0);

	// The range changes whenever data does
	const periods = getModePeriods(range);
	// Changed in place, gaps are added along with a new range
	const gaps = getGaps();
	const compressed = useMemo(() => (compress ? getCompressedSpans(periods, gaps) : []), [compress, periods, gaps]);
	const scale = useMemo(
		() => createTimeScale(range.start, shownDuration, compressed),
		[range.start, shownDuration, compressed],
	);
	const { toPercent } = scale;
	const alerts = useMemo(
		() =>
			showAlerts
				? getAlertSpans(entries, range).toSorted((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? 1 : -1))
				: [],
		[entries, range, showAlerts],
	);

	const shifts = useMemo(() => (showShifts ? getActiveShifts(periods, year) : []), [showShifts, periods, year]);
	// The track moves away from the alerts above it and the shifts below it, only making room for ones that are shown
	const hasAlerts = alerts.length > 0;
	const trackOffset = hasAlerts === shifts.length > 0 ? undefined : hasAlerts ? styles.lowered : styles.raised;

	const hoverAt = (event: PointerEvent): Hover => {
		const rect = track.current!.getBoundingClientRect();
		return { x: Math.min(Math.max(event.clientX - rect.left, 0), rect.width), width: rect.width };
	};
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
	const seekToPointer = (event: PointerEvent) => seek(timeAt(hoverAt(event)));

	/** The tooltip for the pointer `x` px into the track, `undefined` if nothing is known there, ex. before Driver Station data */
	const tooltipAt = (at: Hover) => {
		const hoverTime = timeAt(at);
		if (unread !== undefined && hoverTime > range.end) {
			return <UnreadTooltip {...unread} />;
		}
		const slopPercent = (alertHoverSlop / at.width) * 100;
		const from = scale.toTime(toPercent(hoverTime) - slopPercent);
		const to = scale.toTime(toPercent(hoverTime) + slopPercent);
		const gap = gaps.find((item) => item.start < hoverTime && hoverTime < item.end);
		// Sections share their boundaries, the later one starts there
		const period = gap ?? periods.findLast((item) => item.start <= hoverTime && hoverTime <= item.end);
		const shift = shifts.findLast((item) => item.start <= hoverTime && hoverTime <= item.end);
		const hovered = alerts
			.filter((alert) => alert.start <= to && from <= alert.end)
			.toSorted((a, b) => a.start - b.start);
		return period !== undefined || shift !== undefined || hovered.length > 0 ? (
			<HoverTooltip
				period={period}
				shift={shift}
				compressed={compressed.some((span) => span.start <= hoverTime && hoverTime <= span.end)}
				alerts={hovered}
				hoverTime={hoverTime}
				start={range.origin}
			/>
		) : undefined;
	};
	const tooltip = hover === undefined ? undefined : tooltipAt(hover);

	// Scrolling moves the cursor a fixed time per pixel, so it's as precise in a long log as a short one,
	// following the fingers whichever way the system scrolls.
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
			seek(cursor + delta * scrollTimePerPixel);
		},
		slider,
		{ passive: false },
	);

	const time = use(TimelineCursorContext)!;
	return (
		<div
			ref={slider}
			role="slider"
			tabIndex={0}
			aria-label="Time"
			aria-valuemin={0}
			aria-valuemax={duration / 1_000_000}
			aria-valuenow={(time - range.start) / 1_000_000}
			aria-valuetext={formatTime(time, range.origin)}
			{...stylex.props(scrubberMarker, styles.slider)}
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
			<div ref={track} {...stylex.props(styles.track, trackOffset)}>
				{alerts.map((alert) => (
					<div
						key={`${alert.start}:${alert.level}:${alert.text}`}
						{...stylex.props(styles.alert)}
						style={{
							left: `${toPercent(alert.start)}%`,
							width: `max(0.375rem, ${toPercent(alert.end) - toPercent(alert.start)}%)`,
							backgroundColor: alertFills[alert.level],
						}}
					/>
				))}

				<ScrubberBar
					toPercent={toPercent}
					end={range.end}
					periods={periods}
					gaps={gaps}
					unread={unread !== undefined}
					compressed={compressed}
				/>

				{/* Gaps between shifts mark where they change, ex. the transition shift and shift 1 */}
				{shifts.map((shift) => (
					<div
						key={shift.start}
						{...stylex.props(styles.shift)}
						style={{ left: `${toPercent(shift.start)}%`, width: `${toPercent(shift.end) - toPercent(shift.start)}%` }}
					>
						<div {...stylex.props(styles.shiftFill)} />
					</div>
				))}

				<GraphMarks scale={scale} hoverTime={hover && timeAt(hover)} />

				<ScrubberPosition toPercent={toPercent} property="left" xstyle={styles.playhead} />
				<ScrubberTooltip x={hover?.x} content={tooltip} />
			</div>
		</div>
	);
}
