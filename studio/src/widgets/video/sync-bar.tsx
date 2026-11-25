import ChevronLeftIcon from 'lucide-react/icons/chevron-left';
import ChevronRightIcon from 'lucide-react/icons/chevron-right';
import PauseIcon from 'lucide-react/icons/pause';
import PlayIcon from 'lucide-react/icons/play';
import { colorVars, spacingVars, typeScaleVars, typographyVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { type ReactNode, type RefObject, useEffect, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Slider } from '@astryxdesign/core/Slider';
import { formatTime } from '@/timeline/timeline';
import type { Player } from '@/widgets/video/player';
import { frameLength } from '@/widgets/video/state';

const styles = stylex.create({
	bar: {
		display: 'flex',
		flexWrap: 'wrap',
		alignItems: 'center',
		columnGap: spacingVars['--spacing-2'],
		rowGap: spacingVars['--spacing-1'],
		padding: spacingVars['--spacing-2'],
	},
	time: {
		color: colorVars['--color-text-secondary'],
		fontFamily: typographyVars['--font-family-code'],
		fontSize: typeScaleVars['--text-supporting-size'],
		fontVariantNumeric: 'tabular-nums',
		lineHeight: '1rem',
	},
	scrubber: { minWidth: '6rem', flex: 1 },
	actions: { display: 'flex', alignItems: 'center', gap: spacingVars['--spacing-1'] },
});

/** Sync mode's controls under the video: its own playback and scrubber, and buttons to lock or cancel the sync */
export function SyncBar({
	player,
	duration,
	start,
	canSync,
	onCancel,
	onSync,
}: {
	player: RefObject<Player | null>;
	duration: number | undefined;
	/** Where the video starts (s), only read when Sync mode starts */
	start: number;
	canSync: boolean;
	onCancel: () => void;
	/** Locks the sync with the video's time (s) */
	onSync: (videoTime: number) => void;
}) {
	// Where the video was when Sync mode started, the log's cursor moves on its own while syncing
	const [initial] = useState(start);
	const [time, setTime] = useState(start);
	const [playing, setPlaying] = useState(false);

	// Players keep where they're asked to start until they've loaded
	useEffect(() => {
		player.current?.pause();
		player.current?.setRate(1);
		player.current?.seek(initial);
	}, [player, initial]);

	useEffect(() => {
		if (!playing) {
			return undefined;
		}
		const controls = player.current;
		controls?.play();
		let frame = requestAnimationFrame(function update() {
			setTime(player.current?.time() ?? 0);
			frame = requestAnimationFrame(update);
		});
		return () => {
			cancelAnimationFrame(frame);
			controls?.pause();
		};
	}, [player, playing]);

	const seek = (next: number) => {
		const clamped = Math.min(Math.max(next, 0), duration ?? Infinity);
		setPlaying(false);
		setTime(clamped);
		player.current?.seek(clamped);
	};

	return (
		<div role="toolbar" aria-label="Sync video" {...stylex.props(styles.bar)}>
			<SyncBarButton
				label={playing ? 'Pause video' : 'Play video'}
				icon={playing ? <PauseIcon /> : <PlayIcon />}
				onClick={() => setPlaying(!playing)}
			/>
			<SyncBarButton
				label="Previous frame"
				icon={<ChevronLeftIcon />}
				onClick={() => seek((player.current?.time() ?? time) - frameLength)}
			/>
			<SyncBarButton
				label="Next frame"
				icon={<ChevronRightIcon />}
				onClick={() => seek((player.current?.time() ?? time) + frameLength)}
			/>
			<span {...stylex.props(styles.time)}>{formatTime(time * 1_000_000, 0)}</span>
			<div {...stylex.props(styles.scrubber)}>
				<Slider
					label="Video time"
					isLabelHidden
					valueDisplay="none"
					width="100%"
					min={0}
					max={duration ?? 0}
					step={0.01}
					isDisabled={duration === undefined}
					value={time}
					onChange={(value: number) => seek(value)}
				/>
			</div>
			<div {...stylex.props(styles.actions)}>
				<Button label="Cancel" variant="ghost" size="sm" onClick={onCancel} />
				<Button
					label="Save"
					variant="primary"
					size="sm"
					tooltip="Show this moment of the video at the timeline’s cursor"
					isDisabled={!canSync}
					onClick={() => onSync(player.current?.time() ?? time)}
				/>
			</div>
		</div>
	);
}

function SyncBarButton({ label, icon, onClick }: { label: string; icon: ReactNode; onClick: () => void }) {
	return <IconButton label={label} tooltip={label} icon={icon} variant="ghost" size="sm" onClick={onClick} />;
}
