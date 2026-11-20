import { useTimeRange } from '@/data/data-store';
import { setClipEdge } from '@/desktop/clip';
import { cn } from '@/lib/utils';
import type { TimeScale } from '@/timeline/scale';
import { useClip } from '@/timeline/timeline';

/**
 * The range of a clip being recorded on the timeline, with handles to drag its start and end. The clip's frames show
 * ticks at its start and end instead, unless it's the whole log. They're centered on the track, which moves to make room
 * for the marks above and below it.
 */
export function ClipRange({ scale: { toPercent, toTime }, trackOffset }: { scale: TimeScale; trackOffset: string }) {
	const clip = useClip();
	const range = useTimeRange();
	if (!clip) {
		return null;
	}
	const wholeLog = range !== undefined && clip.start <= range.start && clip.end >= range.end;
	return (
		<>
			<div
				className={cn(
					'pointer-events-none absolute top-1/2 h-5 rounded-sm bg-primary/12 ring-2 ring-primary ring-inset saving-clip:hidden',
					trackOffset,
				)}
				style={{ left: `${toPercent(clip.start)}%`, width: `${toPercent(clip.end) - toPercent(clip.start)}%` }}
			/>
			{!wholeLog &&
				(['start', 'end'] as const).map((edge) => (
					<div
						key={`${edge}-tick`}
						className={cn(
							'pointer-events-none absolute top-1/2 hidden h-5 w-0.5 -translate-x-1/2 rounded-full bg-primary saving-clip:block',
							trackOffset,
						)}
						style={{ left: `${toPercent(clip[edge])}%` }}
					/>
				))}
			{(['start', 'end'] as const).map((edge) => (
				<div
					key={edge}
					aria-hidden
					className={cn(
						'absolute top-1/2 z-10 h-5 w-2 -translate-x-1/2 cursor-ew-resize touch-none rounded-full border-2 border-background bg-primary saving-clip:hidden',
						trackOffset,
					)}
					style={{ left: `${toPercent(clip[edge])}%` }}
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
							setClipEdge(edge, toTime(((event.clientX - track.left) / track.width) * 100));
						}
					}}
				/>
			))}
		</>
	);
}
