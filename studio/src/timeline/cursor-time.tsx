import FastForwardIcon from 'lucide-react/icons/fast-forward';
import { type ComponentPropsWithRef, use, useState } from 'react';
import { Tooltip } from '@astryxdesign/core/Tooltip';
import type { TimeRange } from '@/data/data-store';
import { cn } from '@/lib/utils';
import { getActiveCompressedSpans } from '@/timeline/events';
import { TimeField } from '@/timeline/time-field';
import { formatTime, seek, TimelineCursorContext } from '@/timeline/timeline';

/** The time changes every tick; the tooltip around this button doesn't need to. */
function CursorTimeButton({
	start,
	onEdit,
	onClick,
	...props
}: ComponentPropsWithRef<'button'> & { start: number; onEdit: (text: string) => void }) {
	const time = use(TimelineCursorContext)!;
	const text = formatTime(time, start);
	return (
		<button
			{...props}
			type="button"
			// Right-aligned so the icon stays pinned as the time widens. The negative margin offsets the padding.
			className="-me-1 ms-auto cursor-pointer rounded-md px-1 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11 capture:invisible"
			aria-label={`Current time ${text}, go to time`}
			onClick={(event) => {
				onClick?.(event);
				onEdit(text);
			}}
		>
			{text}
		</button>
	);
}

/** The cursor's time in the timeline bar, click it to type a time to go to */
export function CursorTime({ range }: { range: TimeRange | undefined }) {
	const time = use(TimelineCursorContext);
	// The time shown when the user clicked it to type one, `undefined` while not typing
	const [editText, setEditText] = useState<string>();
	if (range === undefined || time === undefined) {
		return <span className="ms-1.5 min-w-20 text-right font-mono text-sm">-</span>;
	}
	// Also shown while paused, so there's time to hover it for the tooltip
	const skipped = getActiveCompressedSpans(range).some((span) => span.start <= time && time < span.end);
	// Fits the widest time in the log plus the icon (size-3.5 and gap-1), so the label doesn't resize while playing or typing
	const maxLength = formatTime(range.end, range.start).length;
	return (
		<span
			// The end margin makes room for the button's background and the field's border, which reach past the time
			className="relative ms-1.5 me-1 flex shrink-0 items-center gap-1 font-mono text-sm tabular-nums"
			style={{ width: `max(5rem, calc(${maxLength}ch + 1.125rem))` }}
		>
			<span className="absolute end-0 hidden capture:inline">{formatTime(time, range.start)}</span>
			{editText === undefined ? (
				<>
					{/* Always rendered so it can fade in and out, its tooltip only works while it's shown */}
					<Tooltip
						isEnabled={skipped}
						content="The robot was disabled or disconnected, playback fast-forwards through this"
					>
						<span
							className={cn('transition-opacity duration-300 capture:invisible', !skipped && 'opacity-0')}
							aria-label="Skipped idle time"
							aria-hidden={!skipped}
						>
							<FastForwardIcon className="size-3.5 text-muted-foreground" />
						</span>
					</Tooltip>
					<Tooltip content="Go to time">
						<CursorTimeButton start={range.start} onEdit={setEditText} />
					</Tooltip>
				</>
			) : (
				// Reaches past the time as far as the button's padding does, so the text doesn't shift when it's focused
				<span className="-me-1 w-[calc(100%+--spacing(1))] shrink-0 capture:opacity-0">
					<TimeField
						label="Go to time"
						text={editText}
						start={range.start}
						hasAutoFocus
						onCommit={(typed) => {
							if (typed !== undefined) {
								seek(typed);
							}
							setEditText(undefined);
						}}
					/>
				</span>
			)}
		</span>
	);
}
