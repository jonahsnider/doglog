import { useSelector } from '@tanstack/react-store';
import { use, useState } from 'react';
import { zoomedPanesStore } from '@/dashboards/pane-state';
import { DashboardIdContext } from '@/dashboards/panes';
import { cameraStreams } from '@/data/camera-streams';
import { useSource } from '@/data/source-store';
import { findPane } from '@/panes/layout';
import type { CameraImage } from '@/three/camera-frustum';
import { useLiveFollow, useVideoRange } from '@/timeline/timeline';
import { FieldCameraEntry } from '@/widgets/field/camera-entry';
import type { LegendItem } from '@/widgets/legend/legend';
import type { WidgetBinding, WidgetProps } from '@/widgets/widget-type';

/** Pairs each camera's legend controls with the current image for its 3D drawing. */
export function useFieldCameras({
	items,
	layout,
	paneId,
	hasPose,
}: Pick<WidgetProps, 'layout' | 'paneId'> & {
	items: readonly LegendItem[];
	hasPose: (binding: WidgetBinding) => boolean;
}) {
	const source = useSource();
	const live = source?.type === 'live' ? source : undefined;
	const followingLive = useLiveFollow();
	const videoRange = useVideoRange();
	const streams = useSelector(cameraStreams);
	const dashboardId = use(DashboardIdContext);
	const zoomed = useSelector(zoomedPanesStore, (panes) => panes[dashboardId]);
	const paneVisible = zoomed === undefined || zoomed === paneId || !findPane(layout, zoomed);
	const [images, setImages] = useState<ReadonlyMap<string, CameraImage>>(() => new Map());
	const cameraImages = new Map<string, CameraImage>();
	const legend = items.map((item) => {
		const { binding } = item;
		if (binding.role?.id !== 'camera') {
			return item;
		}
		const name = binding.camera?.name;
		const urls = name === undefined ? undefined : streams.get(name);
		const key = JSON.stringify([binding.id, live?.host ?? null, name]);
		let note: string | undefined;
		if (binding.hidden || !paneVisible) {
			note = 'Hidden';
		} else if (name === undefined) {
			note = 'Choose feed';
		} else if (!live || live.status === 'disconnected' || !followingLive || videoRange !== undefined) {
			note = 'Live only';
		} else if (live.status !== 'connected') {
			note = 'Connecting to robot…';
		} else if (!hasPose(binding)) {
			note = 'No pose';
		} else if (urls === undefined) {
			note = 'Feed not advertised';
		}
		const image = note === undefined ? images.get(key) : undefined;
		if (image) {
			cameraImages.set(binding.id, image);
		}
		return {
			...item,
			controls: (
				<FieldCameraEntry
					key={key}
					binding={binding}
					urls={urls}
					note={note}
					onImage={(next) =>
						setImages((current) => {
							const updated = new Map(current);
							if (next) {
								updated.set(key, next);
							} else {
								updated.delete(key);
							}
							return updated;
						})
					}
				/>
			),
		};
	});
	return { legend, cameraImages };
}
