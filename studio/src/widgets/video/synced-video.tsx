import TriangleAlertIcon from 'lucide-react/icons/triangle-exclamation-point';
import { type ReactNode, useCallback, useRef, useState } from 'react';
import { TextMorph } from '@/components/text-morph';
import { Button } from '@astryxdesign/core/Button';
import { formatRoughDuration, getCursorTime, togglePlayback, useCursorTime } from '@/timeline/timeline';
import { WidgetEmpty } from '@/widgets/widget-empty';
import type { WidgetProps } from '@/widgets/widget-type';
import { LocalPlayer } from '@/widgets/video/local-player';
import type { Player, PlayerInfo } from '@/widgets/video/player';
import { formatSync, type Sync, videoTimeAt, youTubeUrl } from '@/widgets/video/source';
import { stopSyncing, useMuted, useSyncing } from '@/widgets/video/state';
import { timelineTimeAt, useFollowCursor } from '@/widgets/video/follow-cursor';
import { MatchFieldMenu } from '@/widgets/video/match-field-menu';
import { SyncBar } from '@/widgets/video/sync-bar';
import { YouTubePlayer } from '@/widgets/video/youtube-player';

export type VideoProps = { paneId: string; sync: Sync; setOption: WidgetProps['setOption'] };

/** What the widget says outside the video, `undefined` while it's in the video */
function outsideLabel(target: number | undefined, duration: number | undefined): ReactNode {
	if (target !== undefined && target < 0) {
		// Split the countdown so minutes and seconds roll as numbers, not as a single text label.
		const [minutes, seconds] = formatRoughDuration(-target * 1_000_000).split(':');
		return (
			<span>
				Starts in <TextMorph>{minutes}</TextMorph>:<TextMorph>{seconds}</TextMorph>
			</span>
		);
	}
	if (target !== undefined && duration !== undefined && target >= duration) {
		return 'Ended';
	}
	return undefined;
}

/** A video that follows the timeline cursor, lined up by `sync`, or is synced by the user in Sync mode */
export function SyncedVideo({
	paneId,
	sync,
	setOption,
	video,
	replace,
}: VideoProps & {
	video: { kind: 'youtube'; id: string } | { kind: 'file'; url: string };
	/** Picks another file when this one can't play */
	replace?: () => void;
}) {
	const player = useRef<Player>(null);
	const [info, setInfo] = useState<PlayerInfo>({});
	const onInfo = useCallback(
		(next: PlayerInfo) =>
			setInfo((previous) => {
				const merged = { ...previous, ...next };
				// YouTube reports the duration several times a second
				return merged.duration === previous.duration && merged.error === previous.error ? previous : merged;
			}),
		[],
	);
	const muted = useMuted(paneId);
	const syncing = useSyncing(paneId);
	const { duration } = info;
	const time = timelineTimeAt(useCursorTime());
	const target = time === undefined ? undefined : videoTimeAt(time, sync);

	useFollowCursor(player, sync, duration, syncing === undefined && !info.error);

	if (info.error) {
		return (
			<WidgetEmpty icon={<TriangleAlertIcon />} title={info.error.title} description={info.error.description}>
				{video.kind === 'youtube' && (
					<Button label="Open on YouTube" href={youTubeUrl(video.id)} target="_blank" rel="noreferrer" />
				)}
				{replace && <Button label="Choose another file…" onClick={replace} />}
			</WidgetEmpty>
		);
	}

	const outside = syncing ? undefined : outsideLabel(target, duration);
	return (
		<div className="flex h-full flex-col">
			<div className="relative min-h-0 flex-1 bg-black">
				{/* The first or last frame, dimmed */}
				<div className={outside === undefined ? 'size-full' : 'size-full opacity-38'}>
					{video.kind === 'youtube' ? (
						<YouTubePlayer id={video.id} muted={muted} ref={player} onInfo={onInfo} />
					) : (
						<>
							<LocalPlayer url={video.url} muted={muted} ref={player} onInfo={onInfo} />
							<MatchFieldMenu key={video.url} player={player} />
						</>
					)}
				</div>
				{outside !== undefined && (
					<span className="pointer-events-none absolute inset-0 grid place-items-center text-sm font-medium text-white tabular-nums">
						{outside}
					</span>
				)}
				{/* Clicking the video plays and pauses like the timeline. Not focusable, Space already plays and pauses everywhere. */}
				{!syncing && (
					<button
						type="button"
						tabIndex={-1}
						aria-label="Play or pause"
						className="absolute inset-0 cursor-default"
						onMouseDown={(event) => event.preventDefault()}
						onClick={togglePlayback}
					/>
				)}
			</div>
			{syncing && (
				<SyncBar
					key={String(syncing.start)}
					player={player}
					duration={duration}
					start={syncing.start ?? Math.min(Math.max(target ?? 0, 0), duration ?? Infinity)}
					canSync={time !== undefined}
					onCancel={() => stopSyncing(paneId)}
					onSync={(videoTime) => {
						const log = timelineTimeAt(getCursorTime());
						if (log !== undefined) {
							setOption('sync', formatSync({ log, video: videoTime }));
							stopSyncing(paneId);
						}
					}}
				/>
			)}
		</div>
	);
}
