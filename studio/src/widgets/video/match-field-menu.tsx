import { type RefObject, use, useEffect, useRef, useState } from 'react';
import { toastManager } from '@/components/ui/toast';
import { getDashboard } from '@/dashboards/dashboards';
import { DashboardIdContext, DashboardLayoutContext, updateLayout } from '@/dashboards/panes';
import { findPane, panes } from '@/panes/layout';
import { useWidgetMenu } from '@/panes/widget-menu';
import { setCameraMatch } from '@/widgets/field/camera-match';
import { pickedOption, setWidgetOption } from '@/widgets/options';
import { widgetOptions } from '@/widgets/widget-info';
import { CameraMatchCrop, type FrameCrop } from '@/widgets/video/camera-match-crop';
import type { CameraMatchResult } from '@/widgets/video/camera-match-worker';
import type { Player } from '@/widgets/video/player';

const failureMessages = {
	tags: 'Pause on a frame with at least two clear AprilTags from the 2026 field.',
	pose: 'Try a frame with tags on different surfaces or farther apart.',
	analysis: 'The frame could not be analyzed. Try again with a local video file.',
};

/** Match a single frame on demand. Scrubbing and playback never run the detector. */
export function MatchFieldMenu({ player }: { player: RefObject<Player | null> }) {
	const layout = use(DashboardLayoutContext);
	const dashboardId = use(DashboardIdContext);
	const cancel = useRef<() => void>(undefined);
	const [selection, setSelection] = useState<{ fieldId: string; frame: HTMLCanvasElement }>();
	useEffect(() => () => cancel.current?.(), []);

	const match = (fieldId: string, frame: HTMLCanvasElement, crop?: FrameCrop) => {
		try {
			// The crop is treated as a separate camera image, including its center and aspect ratio.
			const { x, y, width, height } = crop ?? { x: 0, y: 0, width: frame.width, height: frame.height };
			const image = frame.getContext('2d')!.getImageData(x, y, width, height);
			const worker = new Worker(new URL('./camera-match-worker.ts', import.meta.url), { type: 'module' });
			const toast = toastManager.add({ type: 'loading', title: 'Matching field view…' });
			const stop = () => {
				worker.removeEventListener('message', onMessage);
				worker.removeEventListener('error', onError);
				worker.terminate();
				toastManager.close(toast);
				cancel.current = undefined;
			};
			cancel.current = stop;
			const finish = (result: CameraMatchResult) => {
				if (cancel.current !== stop) {
					return;
				}
				stop();
				if ('failure' in result) {
					toastManager.add({
						type: 'error',
						title: 'Couldn’t match the field view',
						description: failureMessages[result.failure],
					});
					return;
				}
				const currentLayout = getDashboard(dashboardId)?.layout;
				const widget = currentLayout && findPane(currentLayout, fieldId)?.widget;
				if (widget?.type === 'field') {
					if (pickedOption(widget, widgetOptions.field.view) !== '3d') {
						updateLayout(dashboardId, (current) => setWidgetOption(current, fieldId, 'view', '3d'));
					}
					setCameraMatch(fieldId, result.match);
				}
			};
			const onMessage = (event: MessageEvent<CameraMatchResult>) => finish(event.data);
			const onError = () => finish({ failure: 'analysis' });
			worker.addEventListener('message', onMessage);
			worker.addEventListener('error', onError);
			worker.postMessage(image, [image.data.buffer]);
		} catch {
			cancel.current?.();
			toastManager.add({ type: 'error', title: 'Couldn’t read the video frame' });
		}
	};

	const capture = (fieldId: string, cropped: boolean) => {
		if (cancel.current) {
			return;
		}
		try {
			const frame = player.current?.captureFrame?.();
			if (!frame) {
				toastManager.add({
					type: 'warning',
					title: 'No video frame yet',
					description: 'Wait for the video to load and try again.',
				});
			} else if (cropped) {
				setSelection({ fieldId, frame });
			} else {
				match(fieldId, frame);
			}
		} catch {
			toastManager.add({ type: 'error', title: 'Couldn’t read the video frame' });
		}
	};

	useWidgetMenu(() => {
		const fields = panes(layout).filter(({ widget }) => widget?.type === 'field');
		const disabled = cancel.current !== undefined;
		const [only, other] = fields;
		if (!only) {
			return {};
		}
		const item = (label: string, cropped: boolean) =>
			other
				? {
						label,
						items: fields.map(({ id }, index) => ({
							label: `Field ${index + 1}`,
							onSelect: () => capture(id, cropped),
						})),
					}
				: { label, onSelect: () => capture(only.id, cropped) };
		return {
			actions: [
				{
					label: 'Match field view to this frame',
					disabled,
					items: [item('Use full frame', false), item('Crop frame…', true)],
				},
			],
		};
	});

	if (selection) {
		return (
			<CameraMatchCrop
				frame={selection.frame}
				onClose={() => setSelection(undefined)}
				onMatch={(crop) => {
					setSelection(undefined);
					match(selection.fieldId, selection.frame, crop);
				}}
			/>
		);
	}
	return null;
}
