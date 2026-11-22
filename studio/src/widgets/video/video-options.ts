// The video widget's options, see `widgetOptions.video`
import { widgetOptions } from '@/widgets/widget-info';
import type { WidgetOption } from '@/widgets/widget-type';
import { isAbsolutePath, setVideoPath } from '@/widgets/video/local-files';
import { SyncControl, VideoControl } from '@/widgets/video/options';

export const videoOptions: readonly WidgetOption[] = [
	{
		...widgetOptions.video.video,
		control: VideoControl,
		fromAgent: (value, paneId) => {
			if (!isAbsolutePath(value)) {
				return value;
			}
			if (!STUDIO_DESKTOP) {
				throw new Error(
					"Only the desktop app can open videos by path. Set the file's name, and ask the user to choose the file in the widget.",
				);
			}
			return setVideoPath(paneId, value);
		},
	},
	{ ...widgetOptions.video.sync, control: SyncControl },
];
