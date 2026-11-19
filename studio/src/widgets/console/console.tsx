import { useVirtualizer } from '@tanstack/react-virtual';
import { CaseSensitiveIcon, ChevronDownIcon, ChevronUpIcon, RegexIcon, SearchIcon, WholeWordIcon } from 'lucide-react';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppContextMenu } from '@/components/app-context-menu';
import { HighlightedText } from '@/components/highlighted-text';
import { ControlTooltip } from '@/components/control-tooltip';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import { RadioGroup, RadioPrimitive } from '@/components/ui/radio-group';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import { Toggle } from '@/components/ui/toggle';
import { cn } from '@/lib/utils';
import { useDataVersion, useTimeRange } from '@/data/data-store';
import { formatTime, seek, stopFollowing, useCursorTime, useTimeline } from '@/timeline/timeline';
import {
	type ConsoleMessages,
	countAtOrBefore,
	filterMessages,
	matchRanges,
	mergeMessages,
	type MessageLevel,
	messageLevels,
	type SearchOptions,
	searchPattern,
	stepTime,
} from '@/widgets/console/messages';
import type { WidgetProps } from '@/widgets/widget-type';

/** Height of a one line message (px), messages are never shorter so measuring them only moves later rows down */
const rowHeight = 20;

const minimumLevelLabels: Record<MessageLevel, string> = { info: 'All', warning: 'Warnings', error: 'Errors' };

const levelClassNames: Record<MessageLevel, string> = {
	info: 'hover:bg-accent data-popup-open:bg-accent',
	warning: 'bg-warning/8 text-warning-foreground hover:bg-warning/16 data-popup-open:bg-warning/16',
	error: 'bg-destructive/8 text-destructive-foreground hover:bg-destructive/16 data-popup-open:bg-destructive/16',
};

const searchToggles = [
	{ option: 'caseSensitive', label: 'Match case', icon: <CaseSensitiveIcon /> },
	{ option: 'wholeWord', label: 'Match whole word', icon: <WholeWordIcon /> },
	{ option: 'regex', label: 'Use regular expression', icon: <RegexIcon /> },
] as const;

const noMessages: ConsoleMessages = { ids: new Uint32Array(), times: new Float64Array(), texts: [], levels: [] };

export function Console({ bindings }: WidgetProps) {
	useDataVersion();
	const time = useCursorTime();
	const range = useTimeRange();
	const { playback } = useTimeline();
	const [filter, setFilter] = useState('');
	const [options, setOptions] = useState<SearchOptions>({ caseSensitive: false, wholeWord: false, regex: false });
	const [minimumLevel, setMinimumLevel] = useState<MessageLevel>('info');

	/** `undefined` without a filter, and `null` when it's an invalid regular expression */
	const pattern = useMemo(() => {
		if (filter === '') {
			return undefined;
		}
		try {
			return searchPattern(filter, options);
		} catch {
			return null;
		}
	}, [filter, options]);
	const filtering = pattern !== undefined || minimumLevel !== 'info';

	const sources = useMemo(() => bindings.flatMap(({ entry }) => (entry ? [entry.samples] : [])), [bindings]);
	// Samples are mutated in place, so `signature` tells when a bound entry's samples changed and need merging again
	const signature = sources
		.map((samples) => `${samples.length}:${samples.timestamps[0]}:${samples.timestamps[samples.length - 1]}`)
		.join(',');
	// oxlint-disable-next-line react-hooks/exhaustive-deps
	const merged = useMemo(() => mergeMessages(sources), [sources, signature]);
	const messages = useMemo(() => {
		if (pattern === null) {
			return noMessages;
		}
		return filtering ? filterMessages(merged, pattern, minimumLevel) : merged;
	}, [merged, filtering, pattern, minimumLevel]);
	const count = time === undefined ? 0 : countAtOrBefore(messages, time);
	const previousTime = time === undefined ? undefined : stepTime(messages, time, -1);
	const nextTime = time === undefined ? undefined : stepTime(messages, time, 1);

	const scrollElement = useRef<HTMLDivElement>(null);
	// Keyed by message so a message keeps its measured height when filtering changes which messages are shown
	const getItemKey = useCallback((index: number) => messages.ids[index]!, [messages]);
	const virtualizer = useVirtualizer({
		count,
		getScrollElement: () => scrollElement.current,
		estimateSize: () => rowHeight,
		getItemKey,
		overscan: 10,
		// Start at the bottom, where the list is scrolled to on mount (ex. when the pane is split), so the first frame isn't blank
		initialRect: { width: 0, height: window.innerHeight },
		initialOffset: () => Math.max(count * rowHeight - window.innerHeight, 0),
	});

	// Keep the newest message in view while scrolled to the bottom, and always while following live data
	const stickToBottom = useRef(true);
	const lastScrollTop = useRef(0);
	useLayoutEffect(() => {
		const element = scrollElement.current;
		if (playback === 'following') {
			stickToBottom.current = true;
		}
		if (element && stickToBottom.current) {
			element.scrollTop = element.scrollHeight;
			lastScrollTop.current = element.scrollTop;
		}
	});

	const handleScroll = () => {
		const element = scrollElement.current!;
		const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 2;
		// Content shrinking (ex. filtering) can also lower `scrollTop`, but leaves the list scrolled to the bottom
		if (!atBottom && element.scrollTop < lastScrollTop.current) {
			stickToBottom.current = false;
			stopFollowing();
		} else if (atBottom) {
			stickToBottom.current = true;
		}
		lastScrollTop.current = element.scrollTop;
	};

	/** Time of the messages just stepped to, which briefly flash to show where to look */
	const [flashTime, setFlashTime] = useState<number>();

	const seekMessage = (target: number | undefined) => {
		if (target !== undefined) {
			stickToBottom.current = true;
			seek(target);
			setFlashTime(target);
		}
	};

	let emptyText = 'No messages';
	if (pattern === null) {
		emptyText = 'Invalid regular expression';
	} else if (messages.texts.length > 0) {
		emptyText = filtering ? 'No matching messages before the cursor' : 'No messages before the cursor';
	} else if (filtering) {
		emptyText = 'No messages match the filter';
	}

	return (
		<div className="flex h-full flex-col">
			<div className="flex shrink-0 flex-wrap gap-2 p-2">
				<InputGroup className="min-w-56 flex-1">
					<InputGroupAddon>
						<SearchIcon />
					</InputGroupAddon>
					<InputGroupInput
						type="search"
						aria-label="Filter messages"
						aria-invalid={pattern === null || undefined}
						placeholder="Filter messages"
						size="sm"
						value={filter}
						onChange={(event) => setFilter(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === 'Enter') {
								event.preventDefault();
								seekMessage(event.shiftKey ? previousTime : nextTime);
							}
						}}
					/>
					<InputGroupAddon align="inline-end" className="gap-0.5 has-[>button]:-me-1.5">
						{filtering && pattern !== null && (
							<InputGroupText className="me-1 text-xs tabular-nums">
								{count} of {messages.texts.length}
							</InputGroupText>
						)}
						{searchToggles.map(({ option, label, icon }) => (
							<ControlTooltip
								key={option}
								label={label}
								render={
									<Toggle
										className="h-6 min-w-6 rounded-md px-0.5 sm:h-6 sm:min-w-6"
										aria-label={label}
										pressed={options[option]}
										onPressedChange={(pressed) => setOptions({ ...options, [option]: pressed })}
									/>
								}
							>
								{icon}
							</ControlTooltip>
						))}
					</InputGroupAddon>
				</InputGroup>
				<div className="flex shrink-0 items-center">
					<ControlTooltip
						label="Previous message"
						shortcut="Shift+Enter"
						render={
							<Button
								variant="ghost"
								size="icon-xs"
								aria-label="Previous message"
								disabled={previousTime === undefined}
								onClick={() => seekMessage(previousTime)}
							/>
						}
					>
						<ChevronUpIcon />
					</ControlTooltip>
					<ControlTooltip
						label="Next message"
						shortcut="Enter"
						render={
							<Button
								variant="ghost"
								size="icon-xs"
								aria-label="Next message"
								disabled={nextTime === undefined}
								onClick={() => seekMessage(nextTime)}
							/>
						}
					>
						<ChevronDownIcon />
					</ControlTooltip>
				</div>
				<SegmentedControl
					size="sm"
					aria-label="Minimum level"
					render={
						<RadioGroup
							className="shrink-0 flex-row gap-0.5"
							value={minimumLevel}
							onValueChange={(value: MessageLevel) => setMinimumLevel(value)}
						/>
					}
				>
					{messageLevels.map((level) => (
						<SegmentedControlItem key={level} render={<RadioPrimitive.Root value={level} />}>
							{minimumLevelLabels[level]}
						</SegmentedControlItem>
					))}
				</SegmentedControl>
			</div>
			<div
				ref={scrollElement}
				onScroll={handleScroll}
				className="min-h-0 flex-1 overflow-auto py-1 font-mono text-xs select-text"
				role="log"
			>
				{count === 0 ? (
					<p className="p-2 text-muted-foreground italic">{emptyText}</p>
				) : (
					<div className="relative" style={{ height: virtualizer.getTotalSize() }}>
						{virtualizer.getVirtualItems().map((item) => (
							<AppContextMenu
								key={item.key}
								items={[
									{
										label: 'Copy message',
										onSelect: () => void navigator.clipboard.writeText(messages.texts[item.index]!),
									},
								]}
								render={
									<div
										ref={virtualizer.measureElement}
										data-index={item.index}
										data-flash={messages.times[item.index] === flashTime || undefined}
										// Stop flashing once it's done or the user found the message, so it doesn't replay when the row remounts
										onAnimationEnd={() => setFlashTime(undefined)}
										onPointerEnter={() => setFlashTime(undefined)}
										className={cn(
											'absolute inset-x-0 top-0 flex gap-3 px-2 py-0.5 leading-4 data-flash:animate-highlight-fade',
											levelClassNames[messages.levels[item.index]!],
										)}
										style={{ transform: `translateY(${item.start}px)` }}
									/>
								}
							>
								<span className="min-w-[9ch] shrink-0 text-right text-muted-foreground tabular-nums select-none">
									{formatTime(messages.times[item.index]!, range?.start ?? 0)}
								</span>
								<span className="min-w-0 break-words whitespace-pre-wrap">
									<HighlightedText
										text={messages.texts[item.index]!}
										ranges={pattern ? matchRanges(messages.texts[item.index]!, pattern) : undefined}
										className="rounded-xs bg-info/55 text-inherit"
									/>
								</span>
							</AppContextMenu>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
