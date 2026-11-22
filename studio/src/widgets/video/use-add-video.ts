import { type DragEvent, useState } from 'react';
import { draggedFileType } from '@/data/open-log';
import { supportsFileHandles } from '@/data/recent-logs';
import type { WidgetProps } from '@/widgets/widget-type';
import { chooseVideoFile, dropVideoFile, isVideoFile } from '@/widgets/video/local-files';
import { startSyncing } from '@/widgets/video/state';

/** Adds a video picked or dropped in a pane, and starts syncing it */
export function useAddVideo(paneId: string, setOption: WidgetProps['setOption']) {
	const [draggingVideo, setDraggingVideo] = useState(false);
	const addFile = (name: string | undefined) => {
		if (name !== undefined) {
			setOption('video', name);
			startSyncing(paneId, 0);
		}
	};
	return {
		draggingVideo,
		choose: () => void chooseVideoFile(paneId).then(addFile),
		dropProps: {
			onDragOver: (event: DragEvent<HTMLDivElement>) => {
				const type = draggedFileType(event.dataTransfer);
				const video = type?.startsWith('video/') ?? false;
				setDraggingVideo(video);
				if (video || type === '') {
					// With no MIME type, wait for the file name before deciding where the drop goes.
					event.preventDefault();
					event.dataTransfer.dropEffect = 'copy';
				}
			},
			onDragLeave: (event: DragEvent<HTMLDivElement>) => {
				if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) {
					setDraggingVideo(false);
				}
			},
			onDrop: (event: DragEvent<HTMLDivElement>) => {
				setDraggingVideo(false);
				const file = event.dataTransfer.files[0];
				if (file && isVideoFile(file)) {
					event.preventDefault();
					// The handle has to be requested before the event ends
					const handle = supportsFileHandles
						? Array.from(event.dataTransfer.items)
								.find((item) => item.kind === 'file')
								?.getAsFileSystemHandle?.()
						: undefined;
					addFile(dropVideoFile(paneId, file, handle));
				}
			},
		},
	};
}
