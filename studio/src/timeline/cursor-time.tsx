import FastForwardIcon from 'lucide-react/icons/fast-forward';
import { type ComponentPropsWithRef, use, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import type { TimeRange } from '@/data/data-store';
import { isEnterKey } from '@/lib/keyboard';
import { cn } from '@/lib/utils';
import { getActiveCompressedSpans } from '@/timeline/events';
import { parseTime } from '@/timeline/parse-time';
import { formatTime, seek, TimelineCursorContext } from '@/timeline/timeline';

/** Field for typing a time to move the cursor to, shown in place of the current time after clicking it */
function TimeInput({ initialText, start, onDone }: { initialText: string; start: number; onDone: () => void }) {
	const [invalid, setInvalid] = useState(false);
	return (
		<Input
			size="sm"
			// Insets the text as far as the time button does (a 1px border plus padding, past the edge by as much), so it doesn't shift when focused
			className="-me-1 w-[calc(100%+--spacing(1))] shrink-0 capture:opacity-0 [&>input]:px-[calc(--spacing(1)-1px)] [&>input]:text-right"
			aria-label="Go to time"
			aria-invalid={invalid || undefined}
			defaultValue={initialText}
			autoFocus
			onFocus={(event) => event.currentTarget.select()}
			onChange={() => setInvalid(false)}
			onBlur={(event) => {
				const text = event.currentTarget.value;
				// Seeking to the time it already showed would round the cursor to the hundredth
				const parsed = text === initialText ? undefined : parseTime(text, start);
				if (parsed !== undefined) {
					seek(parsed);
				}
				onDone();
			}}
			onKeyDown={(event) => {
				if (isEnterKey(event)) {
					if (parseTime(event.currentTarget.value, start) === undefined) {
						setInvalid(true);
					} else {
						event.currentTarget.blur();
					}
				} else if (event.key === 'Escape') {
					event.currentTarget.value = initialText;
					event.currentTarget.blur();
				}
			}}
		/>
	);
}

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
					<Tooltip disabled={!skipped}>
						<TooltipTrigger
							render={<span />}
							className={cn('transition-opacity duration-300 capture:invisible', !skipped && 'opacity-0')}
							aria-label="Skipped idle time"
							aria-hidden={!skipped}
						>
							<FastForwardIcon className="size-3.5 text-muted-foreground" />
						</TooltipTrigger>
						<TooltipPopup>The robot was disabled or disconnected, playback fast-forwards through this</TooltipPopup>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger render={<CursorTimeButton start={range.start} onEdit={setEditText} />} />
						<TooltipPopup>Go to time</TooltipPopup>
					</Tooltip>
				</>
			) : (
				<TimeInput initialText={editText} start={range.start} onDone={() => setEditText(undefined)} />
			)}
		</span>
	);
}
