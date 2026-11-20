import { use } from 'react';
import { useHoverTime } from '@/timeline/hover';
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
 * The time range graphs are zoomed to, so it's clear where they are in the whole source, and the hovered time: the one
 * the tooltip is about, or the one hovered in a graph
 */
export function GraphMarks({
	toPercent,
	hoverTime,
}: {
	toPercent: (time: number) => number;
	hoverTime: number | undefined;
}) {
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
