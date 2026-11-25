import { colorVars, spacingVars, typeScaleVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import CameraIcon from 'lucide-react/icons/camera';
import { useRef } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { useCameraFeed } from '@/widgets/camera/use-camera-feed';
import { WidgetEmpty, WidgetLoading } from '@/widgets/widget-empty';

const styles = stylex.create({
	root: { position: 'relative', display: 'flex', height: '100%', flexDirection: 'column' },
	feed: { minHeight: 0, flex: 1 },
	hidden: { display: 'none' },
	canvas: { width: '100%', height: '100%', objectFit: 'contain' },
	status: { flexShrink: 0 },
	reconnecting: {
		paddingInline: spacingVars['--spacing-2'],
		paddingBlock: spacingVars['--spacing-1-5'],
		color: colorVars['--color-text-secondary'],
		fontSize: typeScaleVars['--text-supporting-size'],
		lineHeight: '1rem',
	},
});

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
		<div {...stylex.props(styles.root)}>
			<div {...stylex.props(styles.feed, status !== 'live' && styles.hidden)}>
				<canvas ref={canvas} role="img" aria-label={`Live view from ${name}`} {...stylex.props(styles.canvas)} />
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
			<div {...stylex.props(styles.status)} role="status">
				{reconnecting && <p {...stylex.props(styles.reconnecting)}>Reconnecting to robot data…</p>}
			</div>
		);
	}
	if (status === 'loading') {
		return <WidgetLoading label={reconnecting ? 'Reconnecting to robot…' : 'Connecting to camera…'} />;
	}
	if (status === 'permission') {
		return (
			<WidgetEmpty
				icon={<CameraIcon aria-hidden />}
				title="Allow camera access"
				description="Your browser needs permission to reach the camera on your local network."
			>
				<Button label="Allow access" onClick={requestAccess} />
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
