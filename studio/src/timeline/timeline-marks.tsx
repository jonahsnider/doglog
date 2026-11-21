import { use } from 'react';
import { VideoRange } from '@/timeline/video-range';
import { useHoverTime } from '@/timeline/hover';
import type { TimeScale } from '@/timeline/scale';
import { TimelineCursorContext } from '@/timeline/timeline';
import { useZoomedRange } from '@/widgets/graph/view';

/** The playhead and filled track can move without rebuilding the tooltip or the track's other marks. */
export function ScrubberPosition({
	toPercent,
	className,
	property,
}: {
	toPercent: (time: number) => number;
	className: string;
	property: 'left' | 'width';
}) {
	const time = use(TimelineCursorContext)!;
	return <div className={className} style={{ [property]: `${toPercent(time)}%` }} />;
}

/**
 * The time range graphs are zoomed to, so it's clear where they are in the whole source, the hovered time: the one
 * the tooltip is about, or the one hovered in a graph, and the range of a video being exported
 */
export function GraphMarks({
	scale,
	hoverTime,
	trackOffset,
}: {
	scale: TimeScale;
	hoverTime: number | undefined;
	/** How the track is moved to make room for the marks above and below it */
	trackOffset: string;
}) {
	const { toPercent } = scale;
	const zoomed = useZoomedRange();
	const graphHover = useHoverTime();
	const hover = hoverTime ?? graphHover;
	return (
		<>
			{zoomed && (
				<div
					className="pointer-events-none absolute inset-y-0 rounded-sm bg-foreground/8 ring-1 ring-outline ring-inset"
					style={{ left: `${toPercent(zoomed.start)}%`, width: `${toPercent(zoomed.end) - toPercent(zoomed.start)}%` }}
				/>
			)}
			{hover !== undefined && (
				<div
					className="absolute inset-y-0 w-px -translate-x-1/2 bg-muted-foreground capture:invisible"
					style={{ left: `${toPercent(hover)}%` }}
				/>
			)}
			<VideoRange scale={scale} trackOffset={trackOffset} />
		</>
	);
}
