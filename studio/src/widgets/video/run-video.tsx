// A video widget playing a run's video from the team's storage, see `widget-video` in the specs' run videos
import { Button } from '@astryxdesign/core/Button';
import { HStack, StackItem } from '@astryxdesign/core/Layout';
import { Selector } from '@astryxdesign/core/Selector';
import ClapperboardIcon from 'lucide-react/icons/clapperboard';
import { useState } from 'react';
import { toastManager } from '@/components/toast';
import { useSource } from '@/data/source';
import { createStorage } from '@/storage/client';
import { sidecarPath, youtubeId } from '@/storage/format';
import { canReach, refreshListing, useListing } from '@/storage/listing';
import { useStorageUrl } from '@/storage/media';
import { storageRuns } from '@/storage/runs';
import { useTeamStorage } from '@/storage/team-storage';
import { updateSidecar } from '@/storage/video-files';
import { WidgetEmpty, WidgetLoading } from '@/widgets/widget-empty';
import type { WidgetProps } from '@/widgets/widget-type';
import { runVideoValue, type Sync } from '@/widgets/video/source';
import { SyncedVideo } from '@/widgets/video/synced-video';

/** The angles of the videos in the team's storage, for picking a run's video. Empty without storage. */
function useAngles(): string[] {
	const listing = useListing();
	if (!listing.data) {
		return [];
	}
	const angles = storageRuns(listing.data).flatMap((run) => run.videos.map((video) => video.angle));
	return [...new Set(angles)].toSorted((a, b) => a.localeCompare(b));
}

/** Play the time base's run's video by its angle, offered when the team's storage has videos */
export function RunVideoPicker({ setOption }: Pick<WidgetProps, 'setOption'>) {
	const angles = useAngles();
	const [angle, setAngle] = useState<string>();
	if (angles.length === 0) {
		return null;
	}
	const chosen = angle ?? angles[0]!;
	return (
		<HStack gap={2} vAlign="end" width="100%">
			<StackItem size="fill">
				<Selector label="Run video" size="sm" width="100%" options={angles} value={chosen} onChange={setAngle} />
			</StackItem>
			<Button label="Play" size="sm" onClick={() => setOption('video', runVideoValue(chosen))} />
		</HStack>
	);
}

/** The time base's run's video with `angle`, lined up with the sync saved with the video in storage */
export function RunVideo({ angle, paneId, setOption }: Pick<WidgetProps, 'paneId' | 'setOption'> & { angle: string }) {
	const team = useTeamStorage();
	const listing = useListing();
	const source = useSource();
	const fileName = source?.type === 'log' ? source.fileName : undefined;
	const run =
		listing.data && fileName !== undefined
			? storageRuns(listing.data).find((candidate) => candidate.logs.some((log) => log.name === fileName))
			: undefined;
	const video = run?.videos.find((candidate) => candidate.angle.toLowerCase() === angle.toLowerCase());
	const url = useStorageUrl(video?.file, 'video');

	if (!team || !canReach(team.connection)) {
		return (
			<WidgetEmpty
				icon={<ClapperboardIcon />}
				title={`Can’t play the run’s ${angle} video`}
				description={
					team ? 'Your team’s storage needs the desktop app.' : 'Run videos are kept in a Cloud team’s storage.'
				}
			/>
		);
	}
	if (listing.isPending) {
		return <WidgetLoading label="Loading video" hasVisibleLabel={false} isCapturePending />;
	}
	if (!run || !video) {
		return (
			<WidgetEmpty
				icon={<ClapperboardIcon />}
				title={`No ${angle} video`}
				description={
					run
						? `The time base’s run doesn’t have a video called ${angle}.`
						: 'The time base isn’t a log from a run in your team’s storage.'
				}
			/>
		);
	}

	// A moment in the video is the moment in the log plus the offset
	const sync: Sync = { log: Math.max(0, -video.offset), video: Math.max(0, video.offset) };
	const saveSync = (next: Sync) => {
		const sidecar = video.sidecar ?? sidecarPath(video.file!);
		updateSidecar(createStorage(team.connection), sidecar, {
			angle: video.angle,
			offset: Math.round((next.video - next.log) * 1000) / 1000,
		})
			.catch((error: unknown) =>
				toastManager.add({ type: 'error', title: 'Couldn’t save the video’s sync', description: String(error) }),
			)
			.finally(refreshListing);
	};
	const id = video.youtube === undefined ? undefined : youtubeId(video.youtube);
	if (id !== undefined) {
		return (
			<SyncedVideo
				key={id}
				paneId={paneId}
				sync={sync}
				setOption={setOption}
				video={{ kind: 'youtube', id }}
				saveSync={saveSync}
			/>
		);
	}
	if (url === undefined) {
		return <WidgetLoading label="Loading video" hasVisibleLabel={false} isCapturePending />;
	}
	return (
		<SyncedVideo
			key={url}
			paneId={paneId}
			sync={sync}
			setOption={setOption}
			video={{ kind: 'file', url }}
			saveSync={saveSync}
		/>
	);
}
