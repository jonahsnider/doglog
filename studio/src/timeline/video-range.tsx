import { colorVars, radiusVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { useTimeRange } from '@/data/data-store';
import { setVideoRangeEdge } from '@/desktop/video-export';
import type { TimeScale } from '@/timeline/scale';
import { useVideoRange } from '@/timeline/timeline';

// Centered on the track with `--track-offset`, see `Scrubber`
const styles = stylex.create({
	range: {
		position: 'absolute',
		top: '50%',
		height: 20,
		borderRadius: radiusVars['--radius-inner'],
		backgroundColor: `color-mix(in srgb, ${colorVars['--color-accent']} 12%, transparent)`,
		boxShadow: `inset 0 0 0 2px ${colorVars['--color-accent']}`,
		translate: '0 var(--track-offset)',
		pointerEvents: 'none',
	},
	tick: {
		position: 'absolute',
		top: '50%',
		width: 2,
		height: 20,
		borderRadius: radiusVars['--radius-full'],
		backgroundColor: colorVars['--color-accent'],
		translate: '-50% var(--track-offset)',
		pointerEvents: 'none',
	},
	handle: {
		position: 'absolute',
		top: '50%',
		zIndex: 10,
		width: 8,
		height: 20,
		borderWidth: 2,
		borderStyle: 'solid',
		borderColor: colorVars['--color-background-surface'],
		borderRadius: radiusVars['--radius-full'],
		backgroundColor: colorVars['--color-accent'],
		translate: '-50% var(--track-offset)',
		cursor: 'ew-resize',
		touchAction: 'none',
	},
});

/**
 * The range of the video being exported on the timeline, with handles to drag its start and end. The video's frames show
 * ticks at its start and end instead, unless it's the whole log. They're centered on the track, which moves to make room
 * for the marks above and below it.
 */
export function VideoRange({ scale: { toPercent, toTime } }: { scale: TimeScale }) {
	const videoRange = useVideoRange();
	const range = useTimeRange();
	if (!videoRange) {
		return null;
	}
	const wholeLog = range !== undefined && videoRange.start <= range.start && videoRange.end >= range.end;
	const box = stylex.props(styles.range);
	const tick = stylex.props(styles.tick);
	const handle = stylex.props(styles.handle);
	return (
		<>
			<div
				{...box}
				className={`${box.className} saving-video-hidden`}
				style={{
					left: `${toPercent(videoRange.start)}%`,
					width: `${toPercent(videoRange.end) - toPercent(videoRange.start)}%`,
				}}
			/>
			{!wholeLog &&
				(['start', 'end'] as const).map((edge) => (
					<div
						key={`${edge}-tick`}
						{...tick}
						className={`${tick.className} saving-video-only`}
						style={{ left: `${toPercent(videoRange[edge])}%` }}
					/>
				))}
			{(['start', 'end'] as const).map((edge) => (
				<div
					key={edge}
					aria-hidden
					{...handle}
					className={`${handle.className} saving-video-hidden`}
					style={{ left: `${toPercent(videoRange[edge])}%` }}
					onPointerDown={(event) => {
						if (event.button === 0) {
							// Instead of seeking like the slider would
							event.preventDefault();
							event.stopPropagation();
							event.currentTarget.setPointerCapture(event.pointerId);
						}
					}}
					onPointerMove={(event) => {
						const track = event.currentTarget.parentElement?.getBoundingClientRect();
						if (track && event.currentTarget.hasPointerCapture(event.pointerId)) {
							setVideoRangeEdge(edge, toTime(((event.clientX - track.left) / track.width) * 100));
						}
					}}
				/>
			))}
		</>
	);
}
