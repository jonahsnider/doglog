import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import { VStack } from '@astryxdesign/core/Layout';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { Popover } from '@astryxdesign/core/Popover';
import { Text } from '@astryxdesign/core/Text';
import * as stylex from '@stylexjs/stylex';
import Settings2Icon from 'lucide-react/icons/settings-2';
import { use, useRef, useState } from 'react';
import { WidgetBindingsContext } from '@/entries/drag';
import { CameraPicker } from '@/widgets/camera/options';
import { useCameraFeed } from '@/widgets/camera/use-camera-feed';
import { defaultCameraFov, type CameraImage } from '@/three/camera-frustum';
import type { WidgetBinding } from '@/widgets/widget-type';

const styles = stylex.create({
	status: { display: 'flex', minWidth: 0 },
	options: { flexShrink: 0 },
});

export function FieldCameraEntry({
	binding,
	urls,
	note,
	onImage,
}: {
	binding: WidgetBinding;
	urls: readonly string[] | undefined;
	note: string | undefined;
	onImage: (image: CameraImage | undefined) => void;
}) {
	const widget = use(WidgetBindingsContext);
	const [surface] = useState(() => document.createElement('canvas'));
	const shape = useRef<string>(undefined);
	const { status, requestAccess } = useCameraFeed({
		surface: () => surface,
		urls,
		enabled: note === undefined && urls !== undefined,
		onFrame: (canvas) => {
			const size = canvas && `${canvas.width}x${canvas.height}`;
			if (shape.current !== size) {
				shape.current = size;
				onImage(canvas && { canvas, width: canvas.width, height: canvas.height });
			}
			// Refresh the texture without re-rendering the field for each frame.
			canvas?.dispatchEvent(new Event('frame'));
		},
	});
	const settings = binding.camera;
	const label =
		note ??
		{
			loading: 'Connecting…',
			live: settings?.name,
			unavailable: 'Feed unavailable',
			permission: 'Access needed',
			denied: 'Access blocked',
		}[status];
	return (
		<>
			<span {...stylex.props(styles.status)} role="status">
				<Text type="supporting" color="secondary" display="block" maxLines={1}>
					{label}
				</Text>
			</span>
			<Popover
				label="Camera options"
				alignment="end"
				width={240}
				content={
					<VStack gap={3}>
						<CameraPicker
							hasLabel
							value={settings?.name}
							onChange={(name) => widget?.setCamera(binding.id, { ...settings, name })}
						/>
						<NumberInput
							label="Horizontal FOV"
							size="sm"
							units="°"
							width="100%"
							min={1}
							max={179}
							value={settings?.fov ?? defaultCameraFov}
							onChange={(fov) => widget?.setCamera(binding.id, { ...settings, fov })}
						/>
						{note === undefined && status === 'permission' && (
							<>
								<Text type="supporting" color="secondary">
									Allow local network access to reach this camera.
								</Text>
								<Button label="Allow access" size="sm" onClick={requestAccess} />
							</>
						)}
						{note === undefined && !STUDIO_DESKTOP && (status === 'denied' || status === 'unavailable') && (
							<Text type="supporting" color="secondary">
								Check the camera connection and local network permission, or open Studio on desktop.
							</Text>
						)}
						{settings?.name !== undefined && (
							<Button
								label="Clear feed"
								variant="ghost"
								size="sm"
								onClick={() => widget?.setCamera(binding.id, { ...settings, name: undefined })}
							/>
						)}
					</VStack>
				}
			>
				<IconButton
					label={`Camera options for ${binding.name}`}
					tooltip="Camera options"
					icon={<Settings2Icon />}
					variant="ghost"
					size="sm"
					xstyle={styles.options}
				/>
			</Popover>
		</>
	);
}
