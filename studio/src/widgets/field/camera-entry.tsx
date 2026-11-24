import Settings2Icon from 'lucide-react/icons/settings-2';
import { use, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { NumberField, NumberFieldGroup, NumberFieldInput } from '@/components/ui/number-field';
import { Popover, PopoverDescription, PopoverPopup, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { WidgetBindingsContext } from '@/entries/drag';
import { CameraPicker } from '@/widgets/camera/options';
import { useCameraFeed } from '@/widgets/camera/use-camera-feed';
import { defaultCameraFov, type CameraImage } from '@/three/camera-frustum';
import type { WidgetBinding } from '@/widgets/widget-type';

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
			<span className="min-w-0 truncate text-muted-foreground text-xs" role="status" title={label}>
				{label}
			</span>
			<Popover>
				<PopoverTrigger
					render={<Button variant="ghost" size="icon-xs" className="shrink-0" />}
					aria-label={`Camera options for ${binding.name}`}
				>
					<Settings2Icon />
				</PopoverTrigger>
				<PopoverPopup align="end" className="w-60 capture:invisible">
					<div className="flex flex-col gap-3">
						<PopoverTitle>Camera options</PopoverTitle>
						<Field>
							<FieldLabel>Camera feed</FieldLabel>
							<CameraPicker
								value={settings?.name}
								onChange={(name) => widget?.setCamera(binding.id, { ...settings, name })}
							/>
						</Field>
						<Field>
							<FieldLabel>Horizontal FOV (°)</FieldLabel>
							<NumberField
								value={settings?.fov ?? defaultCameraFov}
								min={1}
								max={179}
								onValueCommitted={(fov) => widget?.setCamera(binding.id, { ...settings, fov: fov ?? undefined })}
							>
								<NumberFieldGroup>
									<NumberFieldInput />
								</NumberFieldGroup>
							</NumberField>
						</Field>
						{note === undefined && status === 'permission' && (
							<>
								<PopoverDescription>Allow local network access to reach this camera.</PopoverDescription>
								<Button variant="outline" size="sm" onClick={requestAccess}>
									Allow access
								</Button>
							</>
						)}
						{note === undefined && !STUDIO_DESKTOP && (status === 'denied' || status === 'unavailable') && (
							<PopoverDescription>
								Check the camera connection and local network permission, or open Studio on desktop.
							</PopoverDescription>
						)}
						{settings?.name !== undefined && (
							<Button
								variant="ghost"
								size="sm"
								onClick={() => widget?.setCamera(binding.id, { ...settings, name: undefined })}
							>
								Clear feed
							</Button>
						)}
					</div>
				</PopoverPopup>
			</Popover>
		</>
	);
}
