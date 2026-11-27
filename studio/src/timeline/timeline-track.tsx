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
import type { SourcesRange } from '@/data/data-store';
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
	// Both labels share one cell, so the button keeps the longer one's width and the track doesn't resize
	liveLabel: {
		display: 'grid',
		justifyItems: 'center',
	},
	liveContent: {
		gridArea: '1 / 1',
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-2'],
	},
	liveSizer: {
		visibility: 'hidden',
	},
	// Following is a status rather than an unavailable action, so it isn't dimmed
	liveStatus: {
		opacity: 1,
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
	range: SourcesRange | undefined;
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
			{range && <span {...stylex.props(styles.duration)}>{formatTime(range.end, range.origin)}</span>}
			{live && (
				<Button
					label={following ? 'Live' : 'Go live'}
					variant={following ? 'ghost' : 'secondary'}
					className="capture-hidden"
					isDisabled={following}
					xstyle={styles.liveStatus}
					onClick={goLive}
				>
					<span {...stylex.props(styles.liveLabel)}>
						<span aria-hidden {...stylex.props(styles.liveContent, styles.liveSizer)}>
							<span {...stylex.props(styles.liveDot)} />
							Go live
						</span>
						<span {...stylex.props(styles.liveContent)}>
							<span {...stylex.props(styles.liveDot, following && styles.following)} />
							<TextMorph>{following ? 'Live' : 'Go live'}</TextMorph>
						</span>
					</span>
				</Button>
			)}
		</div>
	);
}
