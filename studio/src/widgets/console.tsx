import { useVirtualizer } from '@tanstack/react-virtual';
import { SearchIcon } from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { useDataVersion, useTimeRange } from '@/data/data-store';
import { stopFollowing, useCursorTime, useTimeline, formatTime } from '@/timeline';
import { countAtOrBefore, filterMessages, mergeMessages } from '@/widgets/console-messages';
import type { WidgetProps } from '@/widgets/widget-type';

/** Height of a one line message (px), messages are never shorter so measuring them only moves later rows down */
const rowHeight = 20;

export function Console({ bindings }: WidgetProps) {
	useDataVersion();
	const time = useCursorTime();
	const range = useTimeRange();
	const { playback } = useTimeline();
	const [filter, setFilter] = useState('');

	const sources = useMemo(() => bindings.flatMap(({ entry }) => (entry ? [entry.samples] : [])), [bindings]);
	// Samples are mutated in place, so `signature` tells when a bound entry's samples changed and need merging again
	const signature = sources
		.map((samples) => `${samples.length}:${samples.timestamps[0]}:${samples.timestamps[samples.length - 1]}`)
		.join(',');
	// oxlint-disable-next-line react-hooks/exhaustive-deps
	const merged = useMemo(() => mergeMessages(sources), [sources, signature]);
	const messages = useMemo(() => (filter ? filterMessages(merged, filter) : merged), [merged, filter]);
	const count = time === undefined ? 0 : countAtOrBefore(messages, time);

	const scrollElement = useRef<HTMLDivElement>(null);
	const virtualizer = useVirtualizer({
		count,
		getScrollElement: () => scrollElement.current,
		estimateSize: () => rowHeight,
		overscan: 10,
		useFlushSync: false,
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

	return (
		<div className="flex h-full flex-col">
			<div className="shrink-0 p-2">
				<InputGroup>
					<InputGroupAddon>
						<SearchIcon />
					</InputGroupAddon>
					<InputGroupInput
						type="search"
						aria-label="Filter messages"
						placeholder="Filter messages"
						size="sm"
						value={filter}
						onChange={(event) => setFilter(event.target.value)}
					/>
				</InputGroup>
			</div>
			<div
				ref={scrollElement}
				onScroll={handleScroll}
				className="min-h-0 flex-1 overflow-auto py-1 font-mono text-xs"
				role="log"
			>
				{count === 0 ? (
					<p className="p-2 text-muted-foreground italic">{filter ? 'No messages match the filter' : 'No messages'}</p>
				) : (
					<div className="relative" style={{ height: virtualizer.getTotalSize() }}>
						{virtualizer.getVirtualItems().map((item) => (
							<div
								key={item.key}
								ref={virtualizer.measureElement}
								data-index={item.index}
								className="absolute inset-x-0 top-0 flex gap-3 px-2 py-0.5 leading-4"
								style={{ transform: `translateY(${item.start}px)` }}
							>
								<span className="min-w-[9ch] shrink-0 text-right text-muted-foreground tabular-nums">
									{formatTime(messages.times[item.index]!, range?.start ?? 0)}
								</span>
								<span className="min-w-0 break-words whitespace-pre-wrap">{messages.texts[item.index]}</span>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
