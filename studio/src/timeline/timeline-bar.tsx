import ChevronsUpDownIcon from 'lucide-react/icons/chevrons-up-down';
import FastForwardIcon from 'lucide-react/icons/fast-forward';
import PauseIcon from 'lucide-react/icons/pause';
import PlayIcon from 'lucide-react/icons/play';
import SlidersHorizontalIcon from 'lucide-react/icons/sliders-horizontal';
import { type Hotkey, type UseHotkeyDefinition, useHotkeys } from '@tanstack/react-hotkeys';
import { Select as SelectPrimitive } from '@base-ui/react/select';
import { AnimatePresence, domAnimation, LazyMotion, m, useIsPresent } from 'motion/react';
import { type ReactNode, useRef, useState } from 'react';
import { TextMorph } from 'torph/react';
import { Button } from '@/components/ui/button';
import { Menu, MenuCheckboxItem, MenuPopup, MenuTrigger } from '@/components/ui/menu';
import { Select, SelectItem, SelectPopup } from '@/components/ui/select';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { LogProgress } from '@/timeline/log-progress';
import { Scrubber } from '@/timeline/timeline-scrubber';
import { getSourceYear } from '@/timeline/shifts';
import { TooltipLabel } from '@/components/tooltip-label';
import { type TimeRange, useTimeRange } from '@/data/data-store';
import { type Source, useSource } from '@/data/source';
import { easing, useMotionTransition } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { updateSettings, useSettings } from '@/settings';
import {
	changeSpeed,
	formatTime,
	getActiveCompressedSpans,
	goLive,
	playbackSpeeds,
	seekHotkeys,
	setSpeed,
	skip,
	step,
	type Timeline,
	togglePlayback,
	useTimeline,
} from '@/timeline/timeline';

const speedItems = playbackSpeeds.map((speed) => ({ value: speed, label: `${speed}x` }));

// YouTube's < and > (Shift+comma and Shift+period on US keyboards) also work, the brackets are shown in the UI
const speedHotkeys: UseHotkeyDefinition[] = [
	{ hotkey: '[', callback: () => changeSpeed(-1) },
	{ hotkey: ']', callback: () => changeSpeed(1) },
	{ hotkey: '<', callback: () => changeSpeed(-1) },
	{ hotkey: '>', callback: () => changeSpeed(1) },
];

const hotkeys: UseHotkeyDefinition[] = [
	{ hotkey: 'Space', callback: togglePlayback, options: { requireReset: true } },
	...seekHotkeys,
	// Same as YouTube
	{ hotkey: 'J', callback: () => skip(-10) },
	{ hotkey: 'K', callback: togglePlayback, options: { requireReset: true } },
	{ hotkey: 'L', callback: () => skip(10) },
	{ hotkey: ',', callback: () => step(-1) },
	{ hotkey: '.', callback: () => step(1) },
	...speedHotkeys,
];

function ControlButton({
	label,
	shortcut,
	onClick,
	children,
}: {
	label: string;
	shortcut: Hotkey;
	onClick: () => void;
	children: ReactNode;
}) {
	return (
		<Tooltip>
			<TooltipTrigger render={<Button variant="ghost" size="icon-sm" aria-label={label} onClick={onClick} />}>
				{children}
			</TooltipTrigger>
			<TooltipPopup>
				<TooltipLabel label={label} shortcut={shortcut} />
			</TooltipPopup>
		</Tooltip>
	);
}

function CursorTime({ range, time }: { range: TimeRange | undefined; time: number | undefined }) {
	if (range === undefined || time === undefined) {
		return <span className="ms-1.5 min-w-20 text-right font-mono text-sm">-</span>;
	}
	// Also shown while paused, so there's time to hover it for the tooltip
	const skipped = getActiveCompressedSpans(range).some((span) => span.start <= time && time < span.end);
	// Reserves room for the widest time in the log plus the icon (size-3.5 and gap-1), so the label doesn't resize while playing
	const maxLength = formatTime(range.end, range.start).length;
	return (
		<span
			className="ms-1.5 flex items-center gap-1 font-mono text-sm tabular-nums"
			style={{ minWidth: `max(5rem, calc(${maxLength}ch + 1.125rem))` }}
		>
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
			{/* Right-aligned on its own so the icon stays pinned to the left edge as the time widens */}
			<span className="ms-auto">{formatTime(time, range.start)}</span>
		</span>
	);
}

function TimelineControls({
	fadeIn,
	range,
	source,
	timeline,
}: {
	fadeIn: boolean;
	range: TimeRange | undefined;
	source: Source;
	timeline: Timeline;
}) {
	const present = useIsPresent();
	const { time, playback, speed, live } = timeline;
	const { timelineAlerts, timelineCompress, timelineShifts } = useSettings();
	const [speedOpen, setSpeedOpen] = useState(false);
	const [optionsOpen, setOptionsOpen] = useState(false);
	const speedTrigger = useRef<HTMLButtonElement>(null);
	const shortcutsEnabled = present && !speedOpen;

	// Skips keys used by a focused text field, button, or menu, and keys already handled, ex. by a pane divider.
	// The speed list and options menu use keys like the arrows and Space themselves, so the shortcuts are off while they're open.
	useHotkeys(hotkeys, { ignoreDefaultPrevented: true, enabled: shortcutsEnabled && !optionsOpen });
	// The focused speed button skips printable keys as typeahead, so its own shortcuts are given to it directly
	useHotkeys(speedHotkeys, { target: speedTrigger, enabled: shortcutsEnabled });

	return (
		<footer aria-label="Timeline" inert={!present} className="flex h-14 rounded-t-lg bg-background contain-strict">
			<div
				className={cn(
					'flex min-w-0 flex-1 items-center gap-1 px-2',
					fadeIn && 'transition-opacity duration-300 starting:opacity-0',
				)}
			>
				<ControlButton label={playback === 'paused' ? 'Play' : 'Pause'} shortcut="Space" onClick={togglePlayback}>
					{playback === 'paused' ? <PlayIcon /> : <PauseIcon />}
				</ControlButton>
				<Select
					items={speedItems}
					value={speed}
					onValueChange={(value) => {
						if (value !== null) {
							setSpeed(value);
						}
					}}
					onOpenChange={setSpeedOpen}
				>
					<Tooltip>
						<TooltipTrigger
							render={
								// A ghost button like its neighbors, since it's rarely used and a bordered select stands out
								<SelectPrimitive.Trigger
									ref={speedTrigger}
									aria-label="Playback speed"
									// Same inset as the icon buttons, so the gaps between controls look even
									render={<Button variant="ghost" size="sm" className="px-1.5 tabular-nums" />}
								/>
							}
						>
							{/* Just the number, so it rolls by place value instead of morphing as a word */}
							<span>
								<TextMorph as="span">{speed}</TextMorph>x
							</span>
							<ChevronsUpDownIcon />
						</TooltipTrigger>
						<TooltipPopup>
							<TooltipLabel label="Playback speed" shortcut={['[', ']']} />
						</TooltipPopup>
					</Tooltip>
					<SelectPopup>
						{speedItems.map((item) => (
							<SelectItem key={item.value} value={item.value}>
								{item.label}
							</SelectItem>
						))}
					</SelectPopup>
				</Select>

				<CursorTime range={range} time={time} />
				{range && time !== undefined ? (
					<Scrubber
						range={range}
						time={time}
						live={live}
						showAlerts={timelineAlerts}
						showShifts={timelineShifts}
						compress={timelineCompress}
						year={getSourceYear(source)}
						unread={source.type === 'log' ? source.unread : undefined}
					/>
				) : (
					<div className="mx-2 h-1 flex-1 rounded-full bg-input" />
				)}
				{/* Margins match the speed button's inset, so text and icons are evenly spaced from neighboring buttons */}
				<span className="me-1.5 font-mono text-sm text-muted-foreground tabular-nums">
					{range ? formatTime(range.end, range.start) : '-'}
				</span>

				{live && (
					<Button
						variant={playback === 'following' ? 'ghost' : 'outline'}
						size="sm"
						disabled={playback === 'following'}
						onClick={goLive}
					>
						<span
							className={cn('size-2 rounded-full', playback === 'following' ? 'bg-destructive' : 'bg-muted-foreground')}
						/>
						{playback === 'following' ? 'Live' : 'Go live'}
					</Button>
				)}

				<Menu onOpenChange={setOptionsOpen}>
					<Tooltip>
						<TooltipTrigger
							render={<MenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Timeline options" />} />}
						>
							<SlidersHorizontalIcon />
						</TooltipTrigger>
						<TooltipPopup>Timeline options</TooltipPopup>
					</Tooltip>
					<MenuPopup align="end">
						<MenuCheckboxItem
							checked={timelineAlerts}
							onCheckedChange={(checked) => updateSettings({ timelineAlerts: checked })}
						>
							Show alerts
						</MenuCheckboxItem>
						<MenuCheckboxItem
							checked={timelineShifts}
							onCheckedChange={(checked) => updateSettings({ timelineShifts: checked })}
						>
							Show active hub shifts
						</MenuCheckboxItem>
						<MenuCheckboxItem
							checked={timelineCompress}
							onCheckedChange={(checked) => updateSettings({ timelineCompress: checked })}
						>
							Skip idle time
						</MenuCheckboxItem>
					</MenuPopup>
				</Menu>
			</div>
		</footer>
	);
}

/** Playback controls and scrubber for the global time cursor, shown while a source is active */
export function TimelineBar() {
	const source = useSource();
	// Pass these in so the exiting controls still show the last cursor and range after the source clears them.
	const range = useTimeRange();
	const timeline = useTimeline();
	const loading = source?.type === 'log' && source.status === 'loading';
	const enter = useMotionTransition({ duration: 0.3, ease: easing.out });
	const exit = useMotionTransition({ duration: 0.2, ease: easing.in });
	// Only fade the controls in when they replace the progress, not every time a dashboard is opened
	const [showedProgress, setShowedProgress] = useState(false);
	if (loading && !showedProgress) {
		setShowedProgress(true);
	}

	return (
		<LazyMotion features={domAnimation} strict>
			<AnimatePresence initial={false}>
				{source && (
					<m.div
						className="shrink-0 overflow-clip"
						// The panes resize with the bar while its fixed-height contents slide past the bottom edge.
						// react-doctor-disable-next-line react-doctor/no-layout-property-animation -- Makes room for the bar as it slides in
						initial={{ height: 0 }}
						// react-doctor-disable-next-line react-doctor/no-layout-property-animation -- Makes room for the bar as it slides in
						animate={{ height: 'auto', transition: enter }}
						// react-doctor-disable-next-line react-doctor/no-layout-property-animation -- Returns space to the panes as the bar slides out
						exit={{ height: 0, transition: exit }}
					>
						{loading ? (
							<LogProgress fileName={source.fileName} />
						) : (
							<TimelineControls fadeIn={showedProgress} range={range} source={source} timeline={timeline} />
						)}
					</m.div>
				)}
			</AnimatePresence>
		</LazyMotion>
	);
}
