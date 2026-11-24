import { useSelector } from '@tanstack/react-store';
import CameraIcon from 'lucide-react/icons/camera';
import { type ComponentProps, use } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { zoomedPanesStore } from '@/dashboards/pane-state';
import { DashboardIdContext } from '@/dashboards/panes';
import { cameraStreams } from '@/data/camera-streams';
import { useSource } from '@/data/source-store';
import { findPane } from '@/panes/layout';
import { goLive, useLiveFollow, useVideoRange } from '@/timeline/timeline';
import { CameraFeed } from '@/widgets/camera/camera-feed';
import { CameraPicker } from '@/widgets/camera/options';
import { WidgetEmpty } from '@/widgets/widget-empty';
import type { WidgetProps } from '@/widgets/widget-type';

function CameraEmpty(props: Omit<ComponentProps<typeof WidgetEmpty>, 'icon'>) {
	return <WidgetEmpty icon={<CameraIcon aria-hidden />} {...props} />;
}

/** A live-only camera pane. Hidden dashboards tear down effects through Activity. */
export function Camera({ options, setOption, layout, paneId }: WidgetProps) {
	const dashboardId = use(DashboardIdContext);
	const zoomedPaneId = useSelector(zoomedPanesStore, (zoomed) => zoomed[dashboardId]);
	const source = useSource();
	const following = useLiveFollow();
	const videoRange = useVideoRange();
	const streams = useSelector(cameraStreams);
	const name = options['camera'] ?? '';
	const urls = streams.get(name);
	const reconnecting = source?.type === 'live' && source.status === 'reconnecting';

	if (zoomedPaneId !== undefined && zoomedPaneId !== paneId && findPane(layout, zoomedPaneId)) {
		return null;
	}
	if (videoRange !== undefined) {
		return <CameraEmpty title="Live camera only" description="Camera frames aren’t recorded." />;
	}
	if (source?.type !== 'live' || source.status === 'disconnected') {
		return (
			<CameraEmpty
				title="Live connection required"
				description="Connect to a robot and show its live session to see cameras."
			/>
		);
	}
	if (source.status === 'connecting' || (reconnecting && !name)) {
		return (
			<div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
				<Spinner className="size-4" />
				{reconnecting ? 'Reconnecting to robot…' : 'Connecting to robot…'}
			</div>
		);
	}
	if (!name) {
		return streams.size === 0 ? (
			<CameraEmpty
				title="No cameras advertised"
				description="The robot isn’t publishing any compatible camera streams."
			/>
		) : (
			<CameraEmpty title="Choose a camera" description="Pick a feed from the live connection.">
				<CameraPicker onChange={(next) => setOption('camera', next)} />
			</CameraEmpty>
		);
	}
	if (!following) {
		return (
			<CameraEmpty title="Camera is live only" description="Follow the latest robot data to resume the feed.">
				<Button variant="outline" size="sm" onClick={goLive}>
					Go live
				</Button>
			</CameraEmpty>
		);
	}
	if (!urls && !reconnecting) {
		return (
			<CameraEmpty title="Camera not advertised" description={`The robot isn’t publishing ${name}.`}>
				{streams.size > 0 && <CameraPicker value={name} onChange={(next) => setOption('camera', next)} />}
			</CameraEmpty>
		);
	}

	return (
		<CameraFeed
			key={JSON.stringify([source.host, name])}
			name={name}
			urls={urls}
			reconnecting={reconnecting}
			rotation={Number(options['rotation'] ?? 0)}
		/>
	);
}
