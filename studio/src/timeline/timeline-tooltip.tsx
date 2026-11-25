import { Text } from '@astryxdesign/core/Text';
import { Tooltip } from '@astryxdesign/core/Tooltip';
import { type ReactNode, useRef, useState } from 'react';
import { alertColors, modeColors, modeLabels, shiftColor } from '@/timeline/colors';
import { cn } from '@/lib/utils';
import { formatRoughDuration, formatTime } from '@/timeline/timeline';
import type { TimeRange } from '@/data/data-store';
import type { UnreadEnd } from '@/data/log-source';
import type { AlertSpan, ModePeriod } from '@/timeline/events';
import type { MatchShift } from '@/timeline/shifts';

const maxListedAlerts = 5;

/** Secondary text that follows the tooltip's inverted surface, which the app's own muted color doesn't */
function Muted({ block, children }: { block?: boolean; children: ReactNode }) {
	return (
		<Text type="inherit" color="secondary" display={block === true ? 'block' : 'inline'} className="tabular-nums">
			{children}
		</Text>
	);
}

/** Spans at least this long (µs) show how far into them the hovered time is, shorter ones only show their length */
const minProgressDuration = 2_000_000;

function TooltipItem({
	color,
	label,
	from,
	to,
	hoverTime,
	start,
}: {
	color: string;
	label: string;
	from: number;
	to: number;
	hoverTime: number;
	start: number;
}) {
	const length = formatTime(to, from);
	return (
		<div>
			<div className="flex items-baseline gap-4">
				<div className="flex min-w-0 flex-1 items-baseline gap-1.5 font-medium">
					<span className={cn('size-2 shrink-0 translate-y-px rounded-full', color)} />
					{label}
				</div>
				<span className="shrink-0">
					<Muted>
						{to - from >= minProgressDuration
							? `${formatTime(Math.min(Math.max(hoverTime, from), to), from)} / ${length}`
							: length}
					</Muted>
				</span>
			</div>
			<div className="ps-3.5">
				<Muted block>
					{formatTime(from, start)} – {formatTime(to, start)}
				</Muted>
			</div>
		</div>
	);
}

/** What was happening at the hovered time: the robot's mode, the shift the hub is active in, then any active alerts */
export function HoverTooltip({
	period,
	shift,
	compressed,
	alerts,
	hoverTime,
	start,
}: {
	/** The robot's mode, or a span the live session was disconnected */
	period: ModePeriod | TimeRange | undefined;
	shift: MatchShift | undefined;
	/** Whether the hovered time is in a compressed span */
	compressed: boolean;
	alerts: readonly AlertSpan[];
	hoverTime: number;
	start: number;
}) {
	return (
		// The popup balances text, which wraps alerts into narrow lines, so they wrap normally up to a wider width
		<div className="flex w-max max-w-md flex-col gap-2 py-0.5 text-pretty">
			{period && (
				<TooltipItem
					color={('mode' in period ? modeColors[period.mode] : undefined) ?? 'bg-input'}
					label={`${'mode' in period ? modeLabels[period.mode] : 'Disconnected'}${compressed ? ' (skipped)' : ''}`}
					from={period.start}
					to={period.end}
					hoverTime={hoverTime}
					start={start}
				/>
			)}
			{shift && (
				<TooltipItem
					color={shiftColor}
					label={`Hub active (${shift.name.toLowerCase()})`}
					from={shift.start}
					to={shift.end}
					hoverTime={hoverTime}
					start={start}
				/>
			)}
			{alerts.length > 0 && (
				<ul className={cn('flex flex-col gap-1.5', (period ?? shift) && 'border-t border-(--color-border) pt-2')}>
					{alerts.slice(0, maxListedAlerts).map((alert) => (
						<li key={`${alert.start}:${alert.level}:${alert.text}`}>
							<TooltipItem
								color={alertColors[alert.level]}
								label={alert.text}
								from={alert.start}
								to={alert.end}
								hoverTime={hoverTime}
								start={start}
							/>
						</li>
					))}
					{alerts.length > maxListedAlerts && (
						<li>
							<Muted>{alerts.length - maxListedAlerts} more</Muted>
						</li>
					)}
				</ul>
			)}
		</div>
	);
}

/** The unreadable end of a log, which has no times, so it shows about how long it would have lasted and how much of the file it is */
export function UnreadTooltip({ percent, duration, after }: UnreadEnd) {
	return (
		<div className="flex w-max max-w-md flex-col py-0.5">
			<div className="flex items-baseline gap-4">
				<div className="flex flex-1 items-baseline gap-1.5 font-medium">
					<span className="size-2 shrink-0 translate-y-px rounded-full bg-destructive" />
					Couldn’t be read
				</div>
				<Muted>estimated {formatRoughDuration(duration)}</Muted>
			</div>
			<div className="ps-3.5">
				<Muted block>
					The last {percent}% of the file, after {formatTime(after, 0)}
				</Muted>
			</div>
		</div>
	);
}

/**
 * The hover tooltip, anchored to the pointer's spot on the track. The slider handles focus and keys, so it's only for
 * pointers. It keeps the last contents and spot while it fades out, instead of shrinking to nothing.
 */
export function ScrubberTooltip({ x, content }: { x: number | undefined; content: ReactNode | undefined }) {
	const anchor = useRef<HTMLSpanElement>(null);
	const [shown, setShown] = useState<{ x: number; content: ReactNode }>();
	// The contents are a new element every render, so only a new spot updates them
	if (x !== undefined && content !== undefined && x !== shown?.x) {
		setShown({ x, content });
	}
	return (
		<>
			<span ref={anchor} className="pointer-events-none absolute inset-y-0 w-0" style={{ left: shown?.x ?? 0 }} />
			<Tooltip anchorRef={anchor} isOpen={content !== undefined} content={content ?? shown?.content} />
		</>
	);
}
