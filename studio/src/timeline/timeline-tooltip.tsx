import { alertColors, modeColors, modeLabels } from '@/timeline/colors';
import { cn } from '@/lib/utils';
import { formatTime } from '@/timeline/timeline';
import type { AlertSpan, ModePeriod } from '@/timeline/events';

/** Most alerts listed in a tooltip */
const maxListedAlerts = 5;

/** Spans at least this long (µs) show how far into them the hovered time is, shorter ones only show their length */
const minProgressDuration = 2_000_000;

/** One thing in the tooltip: a colored dot and label, its length (and progress) on the right, and when it started and ended below */
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
				<span className="shrink-0 text-muted-foreground tabular-nums">
					{to - from >= minProgressDuration
						? `${formatTime(Math.min(Math.max(hoverTime, from), to), from)} / ${length}`
						: length}
				</span>
			</div>
			<div className="ps-3.5 text-muted-foreground tabular-nums">
				{formatTime(from, start)} – {formatTime(to, start)}
			</div>
		</div>
	);
}

/** What was happening at the hovered time: the robot's mode, then any active alerts */
export function HoverTooltip({
	period,
	compressed,
	alerts,
	hoverTime,
	start,
}: {
	period: ModePeriod | undefined;
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
					color={modeColors[period.mode] ?? 'bg-input'}
					label={compressed ? `${modeLabels[period.mode]} (skipped)` : modeLabels[period.mode]}
					from={period.start}
					to={period.end}
					hoverTime={hoverTime}
					start={start}
				/>
			)}
			{alerts.length > 0 && (
				<ul className={cn('flex flex-col gap-1.5', period && 'border-t pt-2')}>
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
						<li className="text-muted-foreground">{alerts.length - maxListedAlerts} more</li>
					)}
				</ul>
			)}
		</div>
	);
}
