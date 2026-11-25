import { Button } from '@astryxdesign/core/Button';
import {
	colorVars,
	radiusVars,
	spacingVars,
	typeScaleVars,
	typographyVars,
} from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { TextMorph } from '@/components/text-morph';
import type { TimeRange } from '@/data/data-store';
import type { Source } from '@/data/source';
import { useSettings } from '@/settings';
import { getSourceYear } from '@/timeline/shifts';
import { formatTime, goLive, type Timeline, TimelineCursorContext } from '@/timeline/timeline';
import { Scrubber } from '@/timeline/timeline-scrubber';

const styles = stylex.create({
	liveDot: {
		width: 8,
		height: 8,
		borderRadius: radiusVars['--radius-full'],
		backgroundColor: colorVars['--color-icon-secondary'],
	},
	following: {
		backgroundColor: colorVars['--color-error'],
	},
	track: {
		display: 'flex',
		alignItems: 'center',
		minWidth: 0,
		height: '100%',
		flex: 1,
		gap: spacingVars['--spacing-1'],
	},
	// Its own row under the controls
	compactTrack: {
		height: '2.75rem',
		flex: null,
		flexBasis: '100%',
		gap: null,
	},
	emptyTrack: {
		flex: 1,
		height: 4,
		marginInline: spacingVars['--spacing-2'],
		borderRadius: radiusVars['--radius-full'],
		backgroundColor: colorVars['--color-border'],
	},
	duration: {
		marginInlineEnd: spacingVars['--spacing-1-5'],
		color: colorVars['--color-text-secondary'],
		fontFamily: typographyVars['--font-family-code'],
		fontSize: typeScaleVars['--text-label-size'],
		lineHeight: typeScaleVars['--text-label-leading'],
		fontVariantNumeric: 'tabular-nums',
	},
});

/** The scrubber, the source's length, and going live */
export function TimelineTrack({
	compact,
	range,
	source,
	timeline,
}: {
	compact: boolean;
	range: TimeRange | undefined;
	source: Source;
	timeline: Timeline;
}) {
	const { time, playback, live, videoRange } = timeline;
	const { timelineAlerts, timelineCompress, timelineShifts } = useSettings();
	const following = playback === 'following';
	return (
		<div {...stylex.props(styles.track, compact && styles.compactTrack)}>
			<TimelineCursorContext value={time}>
				{range && time !== undefined ? (
					<Scrubber
						range={range}
						// Frozen live history doesn't need room to grow.
						live={live && !videoRange}
						showAlerts={timelineAlerts}
						showShifts={timelineShifts}
						compress={timelineCompress}
						year={getSourceYear(source)}
						unread={source.type === 'log' ? source.unread : undefined}
					/>
				) : (
					<div {...stylex.props(styles.emptyTrack)} />
				)}
			</TimelineCursorContext>
			<span {...stylex.props(styles.duration)}>{range ? formatTime(range.end, range.start) : '-'}</span>
			{live && (
				<Button
					label={following ? 'Live' : 'Go live'}
					variant={following ? 'ghost' : 'secondary'}
					icon={<span {...stylex.props(styles.liveDot, following && styles.following)} />}
					className="capture-hidden"
					isDisabled={following}
					onClick={goLive}
				>
					<TextMorph>{following ? 'Live' : 'Go live'}</TextMorph>
				</Button>
			)}
		</div>
	);
}
