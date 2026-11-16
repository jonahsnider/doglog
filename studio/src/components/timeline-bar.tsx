import { PauseIcon, PlayIcon, SkipBackIcon, SkipForwardIcon, StepBackIcon, StepForwardIcon } from 'lucide-react';
import { type Hotkey, type UseHotkeyDefinition, useHotkeys } from '@tanstack/react-hotkeys';
import { type PointerEvent, type ReactNode, useRef, useState } from 'react';
import { useEventListener } from 'usehooks-ts';
import { Button } from '@/components/ui/button';
import { Progress, ProgressIndicator, ProgressLabel, ProgressTrack, ProgressValue } from '@/components/ui/progress';
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipLabel } from '@/components/tooltip-label';
import { type TimeRange, useTimeRange } from '@/data/data-store';
import { useLogProgress, useSource } from '@/data/source';
import { cn } from '@/lib/utils';
import {
	changeSpeed,
	formatTime,
	getCursorTime,
	goLive,
	jumpToEnd,
	jumpToStart,
	playbackSpeeds,
	seek,
	setSpeed,
	skip,
	step,
	togglePlayback,
	useTimeline,
} from '@/timeline';

const speedItems = playbackSpeeds.map((speed) => ({ value: speed, label: `${speed}x` }));

const seekHotkeys: UseHotkeyDefinition[] = [
	{ hotkey: 'ArrowLeft', callback: () => skip(-5) },
	{ hotkey: 'ArrowRight', callback: () => skip(5) },
	{ hotkey: 'Home', callback: jumpToStart },
	{ hotkey: 'End', callback: jumpToEnd },
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
	{ hotkey: '[', callback: () => changeSpeed(-1) },
	{ hotkey: ']', callback: () => changeSpeed(1) },
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

/** Drag, click, or scroll horizontally to move the cursor */
function Scrubber({ range, time }: { range: TimeRange; time: number }) {
	// Non-null so it matches the React 18 `RefObject` that usehooks-ts' `useEventListener` expects
	const slider = useRef<HTMLDivElement>(null!);
	const track = useRef<HTMLDivElement>(null);
	// Hotkeys skip the arrow, Home, and End keys a focused slider uses itself, so they're given to the slider directly
	useHotkeys(seekHotkeys, { target: slider });
	const duration = range.end - range.start;
	const percent = duration > 0 ? ((time - range.start) / duration) * 100 : 100;

	const seekToPointer = (event: PointerEvent) => {
		const rect = track.current!.getBoundingClientRect();
		const fraction = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
		seek(range.start + fraction * duration);
	};

	// Scrolling moves the cursor as far as dragging the same distance would.
	// Not passive so it can stop the browser from treating a horizontal swipe as back or forward.
	useEventListener(
		'wheel',
		(event) => {
			const cursor = getCursorTime();
			if (event.deltaX === 0 || cursor === undefined) {
				return;
			}
			event.preventDefault();
			seek(cursor + (event.deltaX / track.current!.clientWidth) * duration);
		},
		slider,
		{ passive: false },
	);

	return (
		<div
			ref={slider}
			role="slider"
			tabIndex={0}
			aria-label="Time"
			aria-valuemin={0}
			aria-valuemax={duration / 1_000_000}
			aria-valuenow={(time - range.start) / 1_000_000}
			aria-valuetext={formatTime(time, range.start)}
			className="group flex h-full min-w-0 flex-1 cursor-pointer touch-none items-center px-2 outline-none select-none"
			onPointerDown={(event) => {
				if (event.button === 0) {
					event.currentTarget.setPointerCapture(event.pointerId);
					seekToPointer(event);
				}
			}}
			onPointerMove={(event) => {
				if (event.currentTarget.hasPointerCapture(event.pointerId)) {
					seekToPointer(event);
				}
			}}
		>
			<div ref={track} className="relative h-1 w-full rounded-full bg-input">
				<div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${percent}%` }} />
				<div
					className="absolute top-1/2 size-3.5 -translate-1/2 rounded-full border-2 border-primary bg-background group-focus-visible:ring-[3px] group-focus-visible:ring-ring/48"
					style={{ left: `${percent}%` }}
				/>
			</div>
		</div>
	);
}

function TimelineControls({ fadeIn }: { fadeIn: boolean }) {
	const range = useTimeRange();
	const { time, playback, speed, live } = useTimeline();
	const [speedOpen, setSpeedOpen] = useState(false);

	// Skips keys used by a focused text field, button, or menu, and keys already handled, ex. by a pane divider.
	// The speed list only uses the up and down arrows itself, so the shortcuts are off while it's open.
	useHotkeys(hotkeys, { ignoreDefaultPrevented: true, enabled: !speedOpen });

	return (
		<footer aria-label="Timeline" className="flex h-12 shrink-0 border-t">
			{/* Fades the contents so the border stays put */}
			<div
				className={cn(
					'flex min-w-0 flex-1 items-center gap-1 px-2',
					fadeIn && 'transition-opacity duration-300 starting:opacity-0',
				)}
			>
				<ControlButton label="Jump to start" shortcut="Home" onClick={jumpToStart}>
					<SkipBackIcon />
				</ControlButton>
				<ControlButton label="Step back" shortcut="," onClick={() => step(-1)}>
					<StepBackIcon />
				</ControlButton>
				<ControlButton label={playback === 'paused' ? 'Play' : 'Pause'} shortcut="Space" onClick={togglePlayback}>
					{playback === 'paused' ? <PlayIcon /> : <PauseIcon />}
				</ControlButton>
				<ControlButton label="Step forward" shortcut="." onClick={() => step(1)}>
					<StepForwardIcon />
				</ControlButton>
				{!live && (
					<ControlButton label="Jump to end" shortcut="End" onClick={jumpToEnd}>
						<SkipForwardIcon />
					</ControlButton>
				)}

				<span className="ms-1 min-w-20 text-right font-mono text-sm tabular-nums">
					{range && time !== undefined ? formatTime(time, range.start) : '-'}
				</span>
				{range && time !== undefined ? (
					<Scrubber range={range} time={time} />
				) : (
					<div className="mx-2 h-1 flex-1 rounded-full bg-input" />
				)}
				<span className="min-w-20 font-mono text-sm text-muted-foreground tabular-nums">
					{range ? formatTime(range.end, range.start) : '-'}
				</span>

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
						<TooltipTrigger render={<SelectTrigger size="sm" aria-label="Playback speed" className="w-auto min-w-0" />}>
							<SelectValue />
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
			</div>
		</footer>
	);
}

/** Takes the timeline's place while a log loads, so the controls appear where the progress was */
function LogProgress({ fileName }: { fileName: string }) {
	const progress = useLogProgress();
	return (
		<footer aria-label="Timeline" className="flex h-12 shrink-0 items-center border-t px-4">
			{/* Fades in after a moment so small logs that load instantly don't flash it */}
			<Progress
				value={progress * 100}
				className="flex-row items-center gap-3 transition-opacity delay-200 duration-300 starting:opacity-0"
			>
				<ProgressLabel className="max-w-1/3 truncate font-normal text-muted-foreground">
					Loading {fileName}
				</ProgressLabel>
				<ProgressTrack className="h-1 flex-1">
					<ProgressIndicator />
				</ProgressTrack>
				<ProgressValue className="min-w-10 text-right font-mono text-muted-foreground" />
			</Progress>
		</footer>
	);
}

/** Playback controls and scrubber for the global time cursor, shown while a source is active */
export function TimelineBar() {
	const source = useSource();
	const loading = source?.type === 'log' && source.status === 'loading';
	// Only fade the controls in when they replace the progress, not every time a dashboard is opened
	const [showedProgress, setShowedProgress] = useState(false);
	if (loading && !showedProgress) {
		setShowedProgress(true);
	}

	if (loading) {
		return <LogProgress fileName={source.fileName} />;
	}
	return source ? <TimelineControls fadeIn={showedProgress} /> : null;
}
