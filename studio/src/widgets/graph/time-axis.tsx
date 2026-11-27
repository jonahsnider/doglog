import { colorVars, radiusVars, typeScaleVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { memo, useRef, useState } from 'react';
import { useResizeObserver } from 'usehooks-ts';
import { type TimeRange, useTimeRange } from '@/data/data-store';

import { modeFills } from '@/timeline/colors';
import { getActiveCompressedSpans, getModePeriods, type ModePeriod } from '@/timeline/events';
import { HoverTooltip, ScrubberTooltip } from '@/timeline/timeline-tooltip';
import { useSettings } from '@/settings';
import { formatTick, timeTicks } from '@/widgets/graph/ticks';
import { useViewRange } from '@/widgets/graph/view';

/** Labels closer than this to an edge are aligned to it instead of centered, so they aren't cut off */
const edgeLabelPixels = 24;

const styles = stylex.create({
	axis: {
		position: 'relative',
		height: '1.5rem',
		flexShrink: 0,
	},
	fill: {
		position: 'absolute',
		inset: 0,
	},
	strip: {
		position: 'absolute',
		insetInline: 0,
		top: 0,
		height: 4,
		overflow: 'hidden',
		borderRadius: radiusVars['--radius-full'],
		backgroundColor: colorVars['--color-background-muted'],
	},
	span: {
		position: 'absolute',
		top: 0,
		bottom: 0,
	},

	compressed: {
		backgroundColor: colorVars['--color-background-surface'],
		backgroundImage: `repeating-linear-gradient(-45deg, ${colorVars['--color-border']} 0 2px, transparent 2px 4px)`,
	},
	tick: {
		position: 'absolute',
		top: 6,
		fontSize: typeScaleVars['--text-supporting-size'],
		lineHeight: '1rem',
		whiteSpace: 'nowrap',
		color: colorVars['--color-text-secondary'],
		fontVariantNumeric: 'tabular-nums',
	},
	center: {
		translate: '-50% 0',
	},
	end: {
		translate: '-100% 0',
	},
});

/** The hovered mode's tooltip, like the timeline's */
function ModeTooltip({
	x,
	time,
	periods,
	compressed,
	origin,
}: {
	x: number | undefined;
	time: number | undefined;
	periods: readonly ModePeriod[];
	compressed: readonly TimeRange[];
	origin: number | undefined;
}) {
	// Sections share their boundaries, the later one starts there
	const period = time === undefined ? undefined : periods.findLast((item) => item.start <= time && time <= item.end);
	return (
		<ScrubberTooltip
			x={x}
			content={
				period &&
				time !== undefined &&
				origin !== undefined && (
					<HoverTooltip
						period={period}
						shift={undefined}
						compressed={compressed.some((span) => span.start <= time && time <= span.end)}
						alerts={[]}
						hoverTime={time}
						start={origin}
					/>
				)
			}
		/>
	);
}

/**
 * The robot's mode in the timeline's colors, with the spans it compresses hatched, then times labeled like the timeline.
 * Hovering it names the mode like the timeline does.
 */
export const TimeAxis = memo(function TimeAxis({ leftInset, rightInset }: { leftInset: number; rightInset: number }) {
	const element = useRef<HTMLDivElement>(null!);
	const [width, setWidth] = useState(0);
	/** How far into the axis the pointer is, in px */
	const [hoverX, setHoverX] = useState<number>();
	const view = useViewRange();
	const range = useTimeRange();
	const { timelineCompress } = useSettings();

	useResizeObserver({ ref: element, onResize: () => setWidth(element.current.clientWidth) });

	const ticks = view && range && width > 0 ? timeTicks(view, range.origin, width) : undefined;
	const periods = view && range ? getModePeriods(range) : [];
	const compressed = view && range && timelineCompress ? getActiveCompressedSpans(range) : [];
	const toPercent = (time: number) => (view ? ((time - view.start) / (view.end - view.start)) * 100 : 0);
	/** Where a span is in the strip, clipped to the view, `undefined` outside it */
	const placed = (start: number, end: number) => {
		const left = Math.max(toPercent(start), 0);
		const right = Math.min(toPercent(end), 100);
		return right <= left ? undefined : { left: `${left}%`, width: `${right - left}%` };
	};
	const hoverTime =
		view && hoverX !== undefined && width > 0 ? view.start + (hoverX / width) * (view.end - view.start) : undefined;
	return (
		<div {...stylex.props(styles.axis)} style={{ marginLeft: leftInset, marginRight: rightInset }}>
			<div
				ref={element}
				{...stylex.props(styles.fill)}
				onPointerMove={(event) => setHoverX(event.clientX - event.currentTarget.getBoundingClientRect().left)}
				onPointerLeave={() => setHoverX(undefined)}
			>
				<div {...stylex.props(styles.strip)}>
					{periods.map((period) => {
						const color = modeFills[period.mode];
						const style = placed(period.start, period.end);
						return color === undefined || !style ? null : (
							<div key={period.start} {...stylex.props(styles.span)} style={{ ...style, backgroundColor: color }} />
						);
					})}
					{/* Like the timeline, so it's clear which spans it skips through */}
					{compressed.map((span) => {
						const style = placed(span.start, span.end);
						return style && <div key={span.start} {...stylex.props(styles.span, styles.compressed)} style={style} />;
					})}
				</div>
				{ticks?.times.map((time) => {
					const x = (toPercent(time) / 100) * width;
					const align = x < edgeLabelPixels ? 'start' : x > width - edgeLabelPixels ? 'end' : 'center';
					return (
						<span
							key={time}
							{...stylex.props(styles.tick, align === 'center' && styles.center, align === 'end' && styles.end)}
							style={{ left: x }}
						>
							{formatTick(time, range!.origin, ticks.spacing)}
						</span>
					);
				})}
				<ModeTooltip x={hoverX} time={hoverTime} periods={periods} compressed={compressed} origin={range?.origin} />
			</div>
		</div>
	);
});
