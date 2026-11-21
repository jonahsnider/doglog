import { useTimeRange } from '@/data/data-store';
import { setVideoRangeEdge } from '@/desktop/video-export';
import { cn } from '@/lib/utils';
import type { TimeScale } from '@/timeline/scale';
import { useVideoRange } from '@/timeline/timeline';

/**
 * The range of the video being exported on the timeline, with handles to drag its start and end. The video's frames show
 * ticks at its start and end instead, unless it's the whole log. They're centered on the track, which moves to make room
 * for the marks above and below it.
 */
export function VideoRange({ scale: { toPercent, toTime }, trackOffset }: { scale: TimeScale; trackOffset: string }) {
	const videoRange = useVideoRange();
	const range = useTimeRange();
	if (!videoRange) {
		return null;
	}
	const wholeLog = range !== undefined && videoRange.start <= range.start && videoRange.end >= range.end;
	return (
		<>
			<div
				className={cn(
					'pointer-events-none absolute top-1/2 h-5 rounded-sm bg-primary/12 ring-2 ring-primary ring-inset saving-video:hidden',
					trackOffset,
				)}
				style={{
					left: `${toPercent(videoRange.start)}%`,
					width: `${toPercent(videoRange.end) - toPercent(videoRange.start)}%`,
				}}
			/>
			{!wholeLog &&
				(['start', 'end'] as const).map((edge) => (
					<div
						key={`${edge}-tick`}
						className={cn(
							'pointer-events-none absolute top-1/2 hidden h-5 w-0.5 -translate-x-1/2 rounded-full bg-primary saving-video:block',
							trackOffset,
						)}
						style={{ left: `${toPercent(videoRange[edge])}%` }}
					/>
				))}
			{(['start', 'end'] as const).map((edge) => (
				<div
					key={edge}
					aria-hidden
					className={cn(
						'absolute top-1/2 z-10 h-5 w-2 -translate-x-1/2 cursor-ew-resize touch-none rounded-full border-2 border-background bg-primary saving-video:hidden',
						trackOffset,
					)}
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
