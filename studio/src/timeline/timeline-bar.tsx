import { DropdownMenu, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@astryxdesign/core/DropdownMenu';
import { Icon } from '@astryxdesign/core/Icon';
import { IconButton } from '@astryxdesign/core/IconButton';
import { spacingVars } from '@astryxdesign/core/theme/tokens.stylex';
import { Tooltip } from '@astryxdesign/core/Tooltip';
import * as stylex from '@stylexjs/stylex';
import ChevronsUpDownIcon from 'lucide-react/icons/chevrons-up-down';
import PauseIcon from 'lucide-react/icons/pause';
import PlayIcon from 'lucide-react/icons/play';
import { type Hotkey, type UseHotkeyDefinition, useHotkeys } from '@tanstack/react-hotkeys';
import { AnimatePresence, domAnimation, LazyMotion, m, useIsPresent } from 'motion/react';
import { type ReactNode, useRef, useState } from 'react';
import { TextMorph } from '@/components/text-morph';
import { CursorTime } from '@/timeline/cursor-time';
import { LogProgress } from '@/timeline/log-progress';
import { TimelineOptions } from '@/timeline/timeline-options';
import { TimelineTrack } from '@/timeline/timeline-track';
import { TooltipLabel } from '@/components/tooltip-label';
import { type SourcesRange, useTimeRange } from '@/data/data-store';
import { type Source, useSource } from '@/data/source';
import { useCaptureFrame } from '@/desktop/capture';
import { useSize } from '@/hooks/use-size';
import { duration, easing, useMotionTransition } from '@/lib/motion';
import {
	changeSpeed,
	playbackSpeeds,
	setSpeed,
	step,
	type Timeline,
	TimelineCursorContext,
	togglePlayback,
	useTimeline,
} from '@/timeline/timeline';
import { seekHotkeys, skip } from '@/timeline/seek';
import './fade-in.css';

const hotkeys: UseHotkeyDefinition[] = [
	{ hotkey: 'Space', callback: togglePlayback, options: { requireReset: true } },
	...seekHotkeys,
	// Same as YouTube
	{ hotkey: 'J', callback: () => skip(-10) },
	{ hotkey: 'K', callback: togglePlayback, options: { requireReset: true } },
	{ hotkey: 'L', callback: () => skip(10) },
	{ hotkey: ',', callback: () => step(-1) },
	{ hotkey: '.', callback: () => step(1) },
	// YouTube's < and > (Shift+comma and Shift+period on US keyboards) also work, the brackets are shown in the UI
	{ hotkey: '[', callback: () => changeSpeed(-1) },
	{ hotkey: ']', callback: () => changeSpeed(1) },
	{ hotkey: '<', callback: () => changeSpeed(-1) },
	{ hotkey: '>', callback: () => changeSpeed(1) },
];

const styles = stylex.create({
	speed: {
		fontVariantNumeric: 'tabular-nums',
	},
	// Its background fills the home indicator's safe area, its controls stay above it
	bar: {
		display: 'flex',
		height: 'calc(3.5rem + env(safe-area-inset-bottom))',
		paddingBottom: 'env(safe-area-inset-bottom)',
		contain: 'strict',
	},
	compactBar: {
		height: 'calc(5.5rem + env(safe-area-inset-bottom))',
	},
	controls: {
		display: 'flex',
		flex: 1,
		alignItems: 'center',
		gap: spacingVars['--spacing-1'],
		minWidth: 0,
		paddingInline: spacingVars['--spacing-2'],
	},
	compactControls: {
		flexWrap: 'wrap',
		rowGap: 0,
	},
	present: {
		flexShrink: 0,
		overflow: 'clip',
	},
});

function ControlButton({
	label,
	shortcut,
	icon,
	onClick,
}: {
	label: string;
	shortcut: Hotkey;
	icon: ReactNode;
	onClick: () => void;
}) {
	return (
		<Tooltip content={<TooltipLabel label={label} shortcut={shortcut} />}>
			<IconButton label={label} icon={icon} variant="ghost" className="capture-hidden" onClick={onClick} />
		</Tooltip>
	);
}

function TimelineControls({
	fadeIn,
	range,
	source,
	timeline,
}: {
	fadeIn: boolean;
	range: SourcesRange | undefined;
	source: Source;
	timeline: Timeline;
}) {
	const present = useIsPresent();
	const { time, playback, speed } = timeline;
	const [speedOpen, setSpeedOpen] = useState(false);
	const [optionsOpen, setOptionsOpen] = useState(false);
	const bar = useRef<HTMLElement>(null);
	const size = useSize(bar);
	const capture = useCaptureFrame();
	const compact = size !== undefined && size.width < 480;
	const shortcutsEnabled = present && !speedOpen;

	// Skips keys used by a focused text field, button, or menu, and keys already handled, ex. by a pane divider.
	// The speed and options menus use keys like the arrows and Space themselves, so the shortcuts are off while they're open.
	useHotkeys(hotkeys, { ignoreDefaultPrevented: true, enabled: shortcutsEnabled && !optionsOpen });

	const optionsMenu = <TimelineOptions key="options" compact={compact} onOpenChange={setOptionsOpen} />;

	return (
		<footer
			ref={bar}
			aria-label="Timeline"
			inert={!present}
			{...stylex.props(styles.bar, compact && styles.compactBar)}
			style={capture?.timelinePadding}
		>
			<div data-fade-in={fadeIn || undefined} {...stylex.props(styles.controls, compact && styles.compactControls)}>
				<ControlButton
					label={playback === 'paused' ? 'Play' : 'Pause'}
					shortcut="Space"
					icon={playback === 'paused' ? <PlayIcon /> : <PauseIcon />}
					onClick={togglePlayback}
				/>
				<Tooltip content={<TooltipLabel label="Playback speed" shortcut={['[', ']']} />}>
					<DropdownMenu
						// A ghost button like its neighbors, since it's rarely used and a bordered select stands out
						button={{
							label: 'Playback speed',
							variant: 'ghost',
							className: 'capture-hidden',
							endContent: <Icon icon={ChevronsUpDownIcon} size="sm" />,
							// Just the number, so it rolls by place value instead of morphing as a word
							children: (
								<span {...stylex.props(styles.speed)}>
									<TextMorph as="span">{speed}</TextMorph>x
								</span>
							),
						}}
						hasChevron={false}
						placement="above"
						onOpenChange={setSpeedOpen}
					>
						<DropdownMenuRadioGroup
							label="Playback speed"
							value={String(speed)}
							onChange={(value) => setSpeed(Number(value))}
						>
							{playbackSpeeds.map((value) => (
								<DropdownMenuRadioItem key={value} value={String(value)} label={`${value}x`} />
							))}
						</DropdownMenuRadioGroup>
					</DropdownMenu>
				</Tooltip>

				<TimelineCursorContext value={time}>
					<CursorTime range={range} />
				</TimelineCursorContext>
				{compact && optionsMenu}
				<TimelineTrack compact={compact} range={range} source={source} timeline={timeline} />
				{!compact && optionsMenu}
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
	const enter = useMotionTransition({ duration: duration.medium, ease: easing.entrance });
	const exit = useMotionTransition({ duration: duration.exit, ease: easing.exit });
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
						{...stylex.props(styles.present)}
						// The panes resize with the bar while its fixed-height contents slide past the bottom edge.
						// react-doctor-disable-next-line react-doctor/no-layout-property-animation -- Makes room for the bar as it slides in
						initial={{ height: 0 }}
						// react-doctor-disable-next-line react-doctor/no-layout-property-animation -- Makes room for the bar as it slides in
						animate={{ height: 'auto', transition: enter }}
						// react-doctor-disable-next-line react-doctor/no-layout-property-animation -- Returns space to the panes as the bar slides out
						exit={{ height: 0, transition: exit }}
					>
						{loading ? (
							<LogProgress id={source.id} fileName={source.fileName} cancelable={source.cancelable} />
						) : (
							<TimelineControls fadeIn={showedProgress} range={range} source={source} timeline={timeline} />
						)}
					</m.div>
				)}
			</AnimatePresence>
		</LazyMotion>
	);
}
