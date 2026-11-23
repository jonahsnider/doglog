import PauseIcon from 'lucide-react/icons/pause';
import PlayIcon from 'lucide-react/icons/play';
import StepBackIcon from 'lucide-react/icons/step-back';
import StepForwardIcon from 'lucide-react/icons/step-forward';
import { type ReactNode, type RefObject, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { formatTime } from '@/timeline/timeline';
import type { Player } from '@/widgets/video/player';
import { frameLength } from '@/widgets/video/state';

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
		<div role="toolbar" aria-label="Sync video" className="flex flex-wrap items-center gap-x-2 gap-y-1 p-2">
			<SyncBarButton label={playing ? 'Pause video' : 'Play video'} onClick={() => setPlaying(!playing)}>
				{playing ? <PauseIcon /> : <PlayIcon />}
			</SyncBarButton>
			<SyncBarButton label="Previous frame" onClick={() => seek((player.current?.time() ?? time) - frameLength)}>
				<StepBackIcon />
			</SyncBarButton>
			<SyncBarButton label="Next frame" onClick={() => seek((player.current?.time() ?? time) + frameLength)}>
				<StepForwardIcon />
			</SyncBarButton>
			<span className="font-mono text-xs text-muted-foreground tabular-nums">{formatTime(time * 1_000_000, 0)}</span>
			<Slider
				aria-label="Video time"
				className="min-w-24 flex-1"
				min={0}
				max={duration ?? 0}
				step={0.01}
				disabled={duration === undefined}
				value={time}
				onValueChange={(value) => seek(typeof value === 'number' ? value : (value[0] ?? 0))}
			/>
			<div className="flex items-center gap-1">
				<Button variant="ghost" size="sm" onClick={onCancel}>
					Cancel
				</Button>
				<Tooltip>
					<TooltipTrigger
						render={<Button size="sm" disabled={!canSync} onClick={() => onSync(player.current?.time() ?? time)} />}
					>
						Sync
					</TooltipTrigger>
					<TooltipPopup>Show this moment of the video at the timeline’s cursor</TooltipPopup>
				</Tooltip>
			</div>
		</div>
	);
}

function SyncBarButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
	return (
		<Tooltip>
			<TooltipTrigger render={<Button variant="ghost" size="icon-sm" aria-label={label} onClick={onClick} />}>
				{children}
			</TooltipTrigger>
			<TooltipPopup>{label}</TooltipPopup>
		</Tooltip>
	);
}
