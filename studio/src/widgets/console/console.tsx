import { useVirtualizer } from '@tanstack/react-virtual'; // oxlint-disable studio/no-manual-memo -- React Compiler skips this component, because of `useVirtualizer()` and the `react-hooks/exhaustive-deps` suppression
import CaseSensitiveIcon from 'lucide-react/icons/case-sensitive';
import ChevronDownIcon from 'lucide-react/icons/chevron-down';
import ChevronUpIcon from 'lucide-react/icons/chevron-up';
import RegexIcon from 'lucide-react/icons/regex';
import WholeWordIcon from 'lucide-react/icons/whole-word';
import { IconButton } from '@astryxdesign/core/IconButton';
import { InputGroup, InputGroupText } from '@astryxdesign/core/InputGroup';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { TextInput } from '@astryxdesign/core/TextInput';
import { ToggleButton, ToggleButtonGroup } from '@astryxdesign/core/ToggleButton';
import { Tooltip } from '@astryxdesign/core/Tooltip';
import { colorVars, spacingVars, typeScaleVars, typographyVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { type ReactNode, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppContextMenu } from '@/components/app-context-menu';
import { HighlightedText } from '@/components/highlighted-text';
import { TooltipLabel } from '@/components/tooltip-label';
import { isEnterKey } from '@/lib/keyboard';
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
import './console.css';

/** Height of a one line message (px), messages are never shorter so measuring them only moves later rows down */
const rowHeight = 20;

const styles = stylex.create({
	root: { display: 'flex', height: '100%', flexDirection: 'column' },
	toolbar: { display: 'flex', flexShrink: 0, flexWrap: 'wrap', alignItems: 'center', gap: spacingVars['--spacing-2'] },
	toolbarPadding: { padding: spacingVars['--spacing-2'] },
	filter: { minWidth: '14rem', flex: 1 },
	count: { fontVariantNumeric: 'tabular-nums' },
	steps: { display: 'flex', flexShrink: 0, alignItems: 'center' },
	log: { minHeight: 0, flex: 1, overflow: 'auto', paddingBlock: spacingVars['--spacing-1'], lineHeight: '1rem' },
	code: { fontFamily: typographyVars['--font-family-code'], fontSize: typeScaleVars['--text-supporting-size'] },
	empty: { padding: spacingVars['--spacing-2'] },
	rows: { position: 'relative' },
	selectable: { userSelect: 'text' },
	message: { position: 'absolute', insetInline: 0, top: 0, display: 'flex', gap: spacingVars['--spacing-3'] },
	messagePadding: { paddingInline: spacingVars['--spacing-2'], paddingBlock: spacingVars['--spacing-0-5'] },
	time: { flexShrink: 0, minWidth: '9ch', textAlign: 'right', fontVariantNumeric: 'tabular-nums', userSelect: 'none' },
	secondary: { color: colorVars['--color-text-secondary'] },
	text: { minWidth: 0, overflowWrap: 'break-word', whiteSpace: 'pre-wrap' },
});

const minimumLevelLabels: Record<MessageLevel, string> = { info: 'All', warning: 'Warnings', error: 'Errors' };

const searchToggles: readonly { option: keyof SearchOptions; label: string; icon: ReactNode }[] = [
	{ option: 'caseSensitive', label: 'Match case', icon: <CaseSensitiveIcon /> },
	{ option: 'wholeWord', label: 'Match whole word', icon: <WholeWordIcon /> },
	{ option: 'regex', label: 'Use regular expression', icon: <RegexIcon /> },
];

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
	// react-doctor-disable-next-line react-hooks-js/incompatible-library -- React Compiler skips this component rather than memoizing the mutable virtualizer
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
		<div {...stylex.props(styles.root)}>
			<div className={`${stylex.props(styles.toolbar, styles.toolbarPadding).className} capture-invisible`}>
				<div {...stylex.props(styles.filter)}>
					<InputGroup label="Console" isLabelHidden size="sm">
						<TextInput
							type="search"
							label="Filter messages"
							isLabelHidden
							startIcon="search"
							placeholder="Filter messages"
							// The message list says so too, so its message is only on the status icon
							status={pattern === null ? { type: 'error', message: 'Invalid regular expression' } : undefined}
							statusVariant="tooltip"
							value={filter}
							onChange={setFilter}
							onKeyDown={(event) => {
								if (isEnterKey(event)) {
									event.preventDefault();
									seekMessage(event.shiftKey ? previousTime : nextTime);
								}
							}}
						/>
						{filtering && pattern !== null && (
							<InputGroupText xstyle={styles.count}>
								{count} of {messages.texts.length}
							</InputGroupText>
						)}
					</InputGroup>
				</div>
				<ToggleButtonGroup
					label="Filter options"
					type="multiple"
					size="sm"
					value={searchToggles.filter(({ option }) => options[option]).map(({ option }) => option)}
					onChange={(value) => {
						const pressed = new Set(value);
						setOptions({
							caseSensitive: pressed.has('caseSensitive'),
							wholeWord: pressed.has('wholeWord'),
							regex: pressed.has('regex'),
						});
					}}
				>
					{searchToggles.map(({ option, label, icon }) => (
						<ToggleButton key={option} value={option} label={label} icon={icon} isIconOnly />
					))}
				</ToggleButtonGroup>
				<div {...stylex.props(styles.steps)}>
					{(
						[
							{ label: 'Previous message', shortcut: 'Shift+Enter', target: previousTime, icon: <ChevronUpIcon /> },
							{ label: 'Next message', shortcut: 'Enter', target: nextTime, icon: <ChevronDownIcon /> },
						] as const
					).map(({ label, shortcut, target, icon }) => (
						<Tooltip key={label} content={<TooltipLabel label={label} shortcut={shortcut} />}>
							<IconButton
								label={label}
								icon={icon}
								variant="ghost"
								size="sm"
								isDisabled={target === undefined}
								onClick={() => seekMessage(target)}
							/>
						</Tooltip>
					))}
				</div>
				<SegmentedControl
					label="Minimum level"
					size="sm"
					value={minimumLevel}
					onChange={(value) => setMinimumLevel(messageLevels.find((level) => level === value) ?? 'info')}
				>
					{messageLevels.map((level) => (
						<SegmentedControlItem key={level} value={level} label={minimumLevelLabels[level]} />
					))}
				</SegmentedControl>
			</div>
			<div
				ref={scrollElement}
				onScroll={handleScroll}
				{...stylex.props(styles.log, styles.code, styles.selectable)}
				role="log"
			>
				{count === 0 ? (
					<p {...stylex.props(styles.empty, styles.secondary)}>{emptyText}</p>
				) : (
					<div {...stylex.props(styles.rows)} style={{ height: virtualizer.getTotalSize() }}>
						{virtualizer.getVirtualItems().map((item) => (
							<AppContextMenu
								key={item.key}
								label="Message actions"
								// Messages stay selectable to copy part of them
								triggerXstyle={styles.selectable}
								items={[
									{
										label: 'Copy message',
										onSelect: () => void navigator.clipboard.writeText(messages.texts[item.index]!),
									},
								]}
							>
								<div
									ref={virtualizer.measureElement}
									data-index={item.index}
									data-level={messages.levels[item.index]}
									data-flash={messages.times[item.index] === flashTime || undefined}
									// Stop flashing once it's done or the user found the message, so it doesn't replay when the row remounts
									onAnimationEnd={() => setFlashTime(undefined)}
									onPointerEnter={() => setFlashTime(undefined)}
									data-console-message
									{...stylex.props(styles.message, styles.messagePadding)}
									style={{ transform: `translateY(${item.start}px)` }}
								>
									<span {...stylex.props(styles.time, styles.secondary)}>
										{formatTime(messages.times[item.index]!, range?.start ?? 0)}
									</span>
									<span {...stylex.props(styles.text)}>
										<HighlightedText
											text={messages.texts[item.index]!}
											ranges={pattern ? matchRanges(messages.texts[item.index]!, pattern) : undefined}
										/>
									</span>
								</div>
							</AppContextMenu>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
