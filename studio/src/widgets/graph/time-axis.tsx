import { memo, useEffect, useRef, useState } from 'react';
import { useTimeRange } from '@/data/data-store';
import { cn } from '@/lib/utils';
import { modeColors } from '@/timeline/colors';
import { getModePeriods } from '@/timeline/events';
import { getActiveCompressedSpans } from '@/timeline/timeline';
import { useSettings } from '@/settings';
import { formatTick, timeTicks } from '@/widgets/graph/ticks';
import { useViewRange } from '@/widgets/graph/view';

/** Labels closer than this to an edge are aligned to it instead of centered, so they aren't cut off */
const edgeLabelPixels = 24;

/** The robot's mode in the timeline's colors, with the spans it compresses hatched, then times labeled like the timeline */
export const TimeAxis = memo(function TimeAxis({ leftInset, rightInset }: { leftInset: number; rightInset: number }) {
	const element = useRef<HTMLDivElement>(null);
	const [width, setWidth] = useState(0);
	const view = useViewRange();
	const range = useTimeRange();
	const { timelineCompress } = useSettings();

	useEffect(() => {
		const observer = new ResizeObserver(() => setWidth(element.current!.clientWidth));
		observer.observe(element.current!);
		return () => observer.disconnect();
	}, []);

	const ticks = view && range && width > 0 ? timeTicks(view, range.start, width) : undefined;
	const periods = view && range ? getModePeriods(range) : [];
	const compressed = view && range && timelineCompress ? getActiveCompressedSpans(range) : [];
	const toPercent = (time: number) => (view ? ((time - view.start) / (view.end - view.start)) * 100 : 0);
	/** Where a span is in the strip, clipped to the view, `undefined` outside it */
	const placed = (start: number, end: number) => {
		const left = Math.max(toPercent(start), 0);
		const right = Math.min(toPercent(end), 100);
		return right <= left ? undefined : { left: `${left}%`, width: `${right - left}%` };
	};
	return (
		<div className="relative h-6 shrink-0" style={{ marginLeft: leftInset, marginRight: rightInset }}>
			<div ref={element} className="absolute inset-0">
				<div className="absolute inset-x-0 top-0 h-1 overflow-hidden rounded-full bg-muted">
					{periods.map((period) => {
						const color = modeColors[period.mode];
						const style = placed(period.start, period.end);
						return color === undefined || !style ? null : (
							<div key={period.start} className={cn('absolute inset-y-0', color)} style={style} />
						);
					})}
					{/* Like the timeline, so it's clear which spans it skips through */}
					{compressed.map((span) => {
						const style = placed(span.start, span.end);
						return (
							style && (
								<div
									key={span.start}
									className="absolute inset-y-0 bg-background bg-[image:repeating-linear-gradient(-45deg,var(--color-input)_0_2px,transparent_2px_4px)]"
									style={style}
								/>
							)
						);
					})}
				</div>
				{ticks?.times.map((time) => {
					const x = (toPercent(time) / 100) * width;
					const align = x < edgeLabelPixels ? 'start' : x > width - edgeLabelPixels ? 'end' : 'center';
					return (
						<span
							key={time}
							className={cn(
								'absolute top-1.5 text-xs whitespace-nowrap text-muted-foreground tabular-nums',
								align === 'center' && '-translate-x-1/2',
								align === 'end' && '-translate-x-full',
							)}
							style={{ left: x }}
						>
							{formatTick(time, range!.start, ticks.spacing)}
						</span>
					);
				})}
			</div>
		</div>
	);
});
