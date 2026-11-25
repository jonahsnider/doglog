import { colorVars, radiusVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import type { TimeRange } from '@/data/data-store';
import { modeFills } from '@/timeline/colors';
import type { ModePeriod } from '@/timeline/events';
import { ScrubberPosition } from '@/timeline/timeline-marks';

const styles = stylex.create({
	bar: {
		position: 'absolute',
		insetInline: 0,
		top: '50%',
		height: 8,
		overflow: 'hidden',
		borderRadius: radiusVars['--radius-full'],
		backgroundColor: colorVars['--color-background-muted'],
		translate: '0 var(--track-offset)',
		transitionProperty: 'translate',
		transitionDuration: 'calc(150ms * var(--motion-scale))',
		transitionTimingFunction: 'var(--ease-in-out)',
	},
	data: {
		position: 'absolute',
		insetBlock: 0,
		left: 0,
		backgroundColor: colorVars['--color-border'],
	},
	played: {
		position: 'absolute',
		insetBlock: 0,
		left: 0,
		backgroundColor: colorVars['--color-accent'],
	},
	period: {
		position: 'absolute',
		insetBlock: 0,
	},
	gap: {
		position: 'absolute',
		insetBlock: 0,
		minWidth: 3,
		backgroundColor: colorVars['--color-background-body'],
	},
	unread: {
		position: 'absolute',
		insetBlock: 0,
		right: 0,
		backgroundColor: colorVars['--color-error-muted'],
		backgroundImage: `repeating-linear-gradient(-45deg, ${colorVars['--color-error']} 0 2px, transparent 2px 4px)`,
	},
	compressed: {
		position: 'absolute',
		insetBlock: 0,
		backgroundColor: colorVars['--color-background-body'],
		backgroundImage: `repeating-linear-gradient(-45deg, ${colorVars['--color-border']} 0 2px, transparent 2px 4px)`,
	},
});

/** The scrubber's track: the data, colored by the robot's mode, broken where it's missing or hatched where it's skipped */
export function ScrubberBar({
	toPercent,
	end,
	periods,
	gaps,
	unread,
	compressed,
}: {
	toPercent: (time: number) => number;
	/** The end of the data */
	end: number;
	periods: readonly ModePeriod[];
	gaps: readonly TimeRange[];
	/** Whether the log has an unreadable end, after the data */
	unread: boolean;
	compressed: readonly TimeRange[];
}) {
	return (
		<div {...stylex.props(styles.bar)}>
			<div {...stylex.props(styles.data)} style={{ width: `${toPercent(end)}%` }} />
			{periods.length === 0 ? (
				<ScrubberPosition toPercent={toPercent} xstyle={styles.played} property="width" />
			) : (
				periods.map((period) => {
					const color = modeFills[period.mode];
					return color === undefined ? null : (
						<div
							key={period.start}
							{...stylex.props(styles.period)}
							style={{
								left: `${toPercent(period.start)}%`,
								width: `${toPercent(period.end) - toPercent(period.start)}%`,
								backgroundColor: color,
							}}
						/>
					);
				})
			)}
			{/* Disconnected spans break the track since nothing was received, wide enough that short drops stand out */}
			{gaps.map((gap) => (
				<div
					key={gap.start}
					{...stylex.props(styles.gap)}
					style={{ left: `${toPercent(gap.start)}%`, width: `${toPercent(gap.end) - toPercent(gap.start)}%` }}
				/>
			))}
			{/* The unreadable end of a log, hatched since its length is an estimate */}
			{unread && <div {...stylex.props(styles.unread)} style={{ left: `${toPercent(end)}%` }} />}
			{/* Compressed spans are hatched so it's clear they aren't to scale */}
			{compressed.map((span) => (
				<div
					key={span.start}
					{...stylex.props(styles.compressed)}
					style={{ left: `${toPercent(span.start)}%`, width: `${toPercent(span.end) - toPercent(span.start)}%` }}
				/>
			))}
		</div>
	);
}
