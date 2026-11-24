import CameraIcon from 'lucide-react/icons/camera';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { useCameraFeed } from '@/widgets/camera/use-camera-feed';
import { WidgetEmpty } from '@/widgets/widget-empty';

export function CameraFeed({
	name,
	urls,
	reconnecting,
	rotation,
}: {
	name: string;
	urls: readonly string[] | undefined;
	reconnecting: boolean;
	rotation: number;
}) {
	const canvas = useRef<HTMLCanvasElement>(null);
	const { status, requestAccess } = useCameraFeed({ surface: () => canvas.current!, urls, reconnecting, rotation });

	return (
		<div className="relative flex h-full flex-col">
			<div className={cn('min-h-0 flex-1', status !== 'live' && 'hidden')}>
				<canvas ref={canvas} role="img" aria-label={`Live view from ${name}`} className="size-full object-contain" />
			</div>
			<CameraFeedStatus
				status={reconnecting && !urls && status !== 'live' ? 'loading' : status}
				reconnecting={reconnecting}
				requestAccess={requestAccess}
			/>
		</div>
	);
}

function CameraFeedStatus({
	status,
	reconnecting,
	requestAccess,
}: ReturnType<typeof useCameraFeed> & { reconnecting: boolean }) {
	if (status === 'live') {
		return (
			<div className="shrink-0" role="status">
				{reconnecting && <p className="px-2 py-1.5 text-xs text-muted-foreground">Reconnecting to robot data…</p>}
			</div>
		);
	}
	if (status === 'loading') {
		return (
			<div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
				<Spinner className="size-4" />
				{reconnecting ? 'Reconnecting to robot…' : 'Connecting to camera…'}
			</div>
		);
	}
	if (status === 'permission') {
		return (
			<WidgetEmpty
				icon={<CameraIcon aria-hidden />}
				title="Allow camera access"
				description="Your browser needs permission to reach the camera on your local network."
			>
				<Button variant="outline" size="sm" onClick={requestAccess}>
					Allow access
				</Button>
			</WidgetEmpty>
		);
	}
	const description = STUDIO_DESKTOP
		? 'Check that the camera is connected. Studio will keep trying.'
		: status === 'denied'
			? 'Allow local network access in your browser’s site settings, or open Studio on desktop.'
			: 'Check the camera connection and local network permission, or open Studio on desktop.';
	return <WidgetEmpty icon={<CameraIcon aria-hidden />} title="Camera feed unavailable" description={description} />;
}
