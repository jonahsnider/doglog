import FastForwardIcon from 'lucide-react/icons/fast-forward';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import type { TimeRange } from '@/data/data-store';
import { isEnterKey } from '@/lib/keyboard';
import { cn } from '@/lib/utils';
import { formatTime, getActiveCompressedSpans, seek } from '@/timeline/timeline';

/**
 * Parse a time typed like `formatTime()` shows it, ex. `1:05.5`, or as seconds, ex. `65.5`,
 * into µs on the clock `start` is on. `undefined` if it isn't a time.
 */
function parseTime(text: string, start: number): number | undefined {
	const match = /^(?:(\d+):)?(\d+(?:\.\d*)?|\.\d+)$/u.exec(text.trim());
	if (!match) {
		return undefined;
	}
	const [, minutes = '0', seconds = '0'] = match;
	return start + Math.round((Number(minutes) * 60 + Number(seconds)) * 1_000_000);
}

/** Field for typing a time to move the cursor to, shown in place of the current time after clicking it */
function TimeInput({ initialText, start, onDone }: { initialText: string; start: number; onDone: () => void }) {
	const [invalid, setInvalid] = useState(false);
	return (
		<Input
			size="sm"
			// Insets the text as far as the time button does (a 1px border plus padding, past the edge by as much), so it doesn't shift when focused
			className="-me-1 w-[calc(100%+--spacing(1))] shrink-0 [&>input]:px-[calc(--spacing(1)-1px)] [&>input]:text-right"
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

/** The cursor's time in the timeline bar, click it to type a time to go to */
export function CursorTime({ range, time }: { range: TimeRange | undefined; time: number | undefined }) {
	// The time shown when the user clicked it to type one, `undefined` while not typing
	const [editText, setEditText] = useState<string>();
	if (range === undefined || time === undefined) {
		return <span className="ms-1.5 min-w-20 text-right font-mono text-sm">-</span>;
	}
	// Also shown while paused, so there's time to hover it for the tooltip
	const skipped = getActiveCompressedSpans(range).some((span) => span.start <= time && time < span.end);
	// Fits the widest time in the log plus the icon (size-3.5 and gap-1), so the label doesn't resize while playing or typing
	const maxLength = formatTime(range.end, range.start).length;
	const text = formatTime(time, range.start);
	return (
		<span
			// The end margin makes room for the button's background and the field's border, which reach past the time
			className="ms-1.5 me-1 flex shrink-0 items-center gap-1 font-mono text-sm tabular-nums"
			style={{ width: `max(5rem, calc(${maxLength}ch + 1.125rem))` }}
		>
			{editText === undefined ? (
				<>
					{/* Always rendered so it can fade in and out, its tooltip only works while it's shown */}
					<Tooltip disabled={!skipped}>
						<TooltipTrigger
							render={<span />}
							className={cn('transition-opacity duration-300', !skipped && 'opacity-0')}
							aria-label="Skipped idle time"
							aria-hidden={!skipped}
						>
							<FastForwardIcon className="size-3.5 text-muted-foreground" />
						</TooltipTrigger>
						<TooltipPopup>The robot was disabled or disconnected, playback fast-forwards through this</TooltipPopup>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger
							render={
								<button
									type="button"
									// Right-aligned on its own so the icon stays pinned to the left edge as the time widens.
									// The negative margin keeps the text where it was without the button's padding.
									className="-me-1 ms-auto cursor-pointer rounded-md px-1 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
									aria-label={`Current time ${text}, go to time`}
									onClick={() => setEditText(text)}
								/>
							}
						>
							{text}
						</TooltipTrigger>
						<TooltipPopup>Go to time</TooltipPopup>
					</Tooltip>
				</>
			) : (
				<TimeInput initialText={editText} start={range.start} onDone={() => setEditText(undefined)} />
			)}
		</span>
	);
}
