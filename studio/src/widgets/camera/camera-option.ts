import { cameraNames, cameraStreams } from '@/data/camera-streams';
import { getSource } from '@/data/source-store';
import { panes } from '@/panes/layout';
import { CameraOptionControl } from '@/widgets/camera/options';
import { pickedOption } from '@/widgets/options';
import { widgetOptions } from '@/widgets/widget-info';
import type { WidgetOption } from '@/widgets/widget-type';

const option = widgetOptions.camera.camera;

export const cameraOption: WidgetOption = {
	...option,
	initial: (layout) => {
		const source = getSource();
		if (source?.type !== 'live' || source.status !== 'connected') {
			return undefined;
		}
		const used = new Set(
			panes(layout).map(({ widget }) => (widget?.type === 'camera' ? pickedOption(widget, option) : undefined)),
		);
		return cameraNames(cameraStreams.get()).find((name) => !used.has(name));
	},
	control: CameraOptionControl,
};
