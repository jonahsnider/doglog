import ClapperboardIcon from 'lucide-react/icons/clapperboard';
import FileVideoIcon from 'lucide-react/icons/file-video';
import TriangleAlertIcon from 'lucide-react/icons/triangle-exclamation-point';
import { useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useSource } from '@/data/source';
import { WidgetEmpty } from '@/widgets/widget-empty';
import type { WidgetProps } from '@/widgets/widget-type';
import { AddVideo } from '@/widgets/video/add-video';
import { useAddVideo } from '@/widgets/video/use-add-video';
import { useLocalVideo } from '@/widgets/video/local-files';
import { parseSync, parseVideo } from '@/widgets/video/source';
import { SyncedVideo, type VideoProps } from '@/widgets/video/synced-video';

/** A video of the match that plays along with the log, see `widget-video` in the specs */
export function Video({ options, setOption, paneId }: WidgetProps) {
	const source = useSource();
	const video = parseVideo(options['video'] ?? '');

	if (source?.type !== 'log') {
		return (
			<WidgetEmpty
				icon={<ClapperboardIcon />}
				title="Videos play with logs"
				description={video ? 'Open a log to watch this video with it.' : 'Open a log to add a video of it.'}
			/>
		);
	}
	if (video === undefined) {
		return <AddVideo paneId={paneId} setOption={setOption} />;
	}
	if (video.kind === 'unsupported') {
		return (
			<WidgetEmpty
				icon={<TriangleAlertIcon />}
				title="Studio can’t play this link"
				description="Videos can be YouTube links or video files."
			>
				<Button variant="outline" size="sm" onClick={() => setOption('video', undefined)}>
					Remove video
				</Button>
			</WidgetEmpty>
		);
	}
	const sync = parseSync(options['sync'] ?? '');
	return video.kind === 'youtube' ? (
		<YouTubeVideo key={video.id} id={video.id} paneId={paneId} sync={sync} setOption={setOption} />
	) : (
		<LocalVideo key={video.name} name={video.name} paneId={paneId} sync={sync} setOption={setOption} />
	);
}

/** Whether the device is online, YouTube needs a connection */
function useOnline(): boolean {
	return useSyncExternalStore(
		(onChange) => {
			window.addEventListener('online', onChange);
			window.addEventListener('offline', onChange);
			return () => {
				window.removeEventListener('online', onChange);
				window.removeEventListener('offline', onChange);
			};
		},
		() => navigator.onLine,
	);
}

function YouTubeVideo({ id, ...props }: VideoProps & { id: string }) {
	const online = useOnline();
	if (!online) {
		return (
			<WidgetEmpty
				icon={<ClapperboardIcon />}
				title="Connect to the internet to play YouTube videos"
				description="Videos saved on this device play offline."
			/>
		);
	}
	return <SyncedVideo {...props} video={{ kind: 'youtube', id }} />;
}

function LocalVideo({ name, ...props }: VideoProps & { name: string }) {
	const { paneId, setOption } = props;
	const local = useLocalVideo(paneId, name);
	const { choose, dropProps } = useAddVideo(paneId, setOption);

	if (local.state === 'loading') {
		return (
			<div data-capture-pending className="grid h-full place-items-center">
				<Spinner aria-label="Loading video" className="size-4 text-muted-foreground" />
			</div>
		);
	}
	if (local.state === 'allow') {
		return (
			<WidgetEmpty
				icon={<FileVideoIcon />}
				title={name}
				description="Your browser needs permission to play this video again."
			>
				<Button variant="outline" size="sm" onClick={local.allow}>
					Allow access to {name}
				</Button>
			</WidgetEmpty>
		);
	}
	if (local.state === 'missing') {
		return (
			<div {...dropProps} className="h-full">
				<WidgetEmpty
					icon={<FileVideoIcon />}
					title={STUDIO_DESKTOP ? `Find ${name}` : `Choose ${name} again`}
					description={
						STUDIO_DESKTOP
							? "Studio can't find this video on this computer, it may have been moved, or added on another device."
							: "Your browser doesn't keep access to video files, or it was added on another device."
					}
				>
					<Button variant="outline" size="sm" onClick={choose}>
						<FileVideoIcon />
						Choose file…
					</Button>
				</WidgetEmpty>
			</div>
		);
	}
	return <SyncedVideo {...props} video={{ kind: 'file', url: local.url }} replace={choose} />;
}
