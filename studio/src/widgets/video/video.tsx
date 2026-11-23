import ClapperboardIcon from 'lucide-react/icons/clapperboard';
import FileVideoIcon from 'lucide-react/icons/file-video';
import TriangleAlertIcon from 'lucide-react/icons/triangle-exclamation-point';
import { type ReactNode, useSyncExternalStore } from 'react';
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

/** A video of the match that follows the timeline, see `widget-video` in the specs */
export function Video({ options, setOption, paneId }: WidgetProps) {
	const source = useSource();
	const video = parseVideo(options['video'] ?? '');
	const { choose, dropProps, draggingVideo } = useAddVideo(paneId, setOption);

	if (source === undefined) {
		return (
			<WidgetEmpty
				icon={<ClapperboardIcon />}
				title="Choose a data source"
				description="Open a log or connect to follow its timeline with a video."
			/>
		);
	}
	let content: ReactNode;
	if (video === undefined) {
		content = <AddVideo paneId={paneId} setOption={setOption} choose={choose} />;
	} else if (video.kind === 'unsupported') {
		content = (
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
	} else {
		const sync = parseSync(options['sync'] ?? '');
		content =
			video.kind === 'youtube' ? (
				<YouTubeVideo key={video.id} id={video.id} paneId={paneId} sync={sync} setOption={setOption} />
			) : (
				<LocalVideo
					key={video.name}
					name={video.name}
					paneId={paneId}
					sync={sync}
					setOption={setOption}
					choose={choose}
				/>
			);
	}
	return (
		<div {...dropProps} className="relative h-full">
			{content}
			{draggingVideo && (
				<div className="pointer-events-none absolute inset-1 grid items-start justify-items-center rounded-lg border-2 border-dashed border-primary bg-primary/8 p-2">
					<span className="rounded-full bg-primary px-3 py-1.5 text-center text-sm font-medium text-primary-foreground">
						{video === undefined ? 'Drop to add video' : 'Drop to replace video'}
					</span>
				</div>
			)}
		</div>
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

function LocalVideo({ name, choose, ...props }: VideoProps & { name: string; choose: () => void }) {
	const local = useLocalVideo(props.paneId, name);

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
		);
	}
	return <SyncedVideo {...props} video={{ kind: 'file', url: local.url }} replace={choose} />;
}
