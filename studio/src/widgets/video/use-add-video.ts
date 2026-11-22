import type { DragEvent } from 'react';
import { supportsFileHandles } from '@/data/recent-logs';
import type { WidgetProps } from '@/widgets/widget-type';
import { chooseVideoFile, dropVideoFile, isVideoFile } from '@/widgets/video/local-files';
import { startSyncing } from '@/widgets/video/state';

/** Adds a video picked or dropped in a pane, and starts syncing it */
export function useAddVideo(paneId: string, setOption: WidgetProps['setOption']) {
	const addFile = (name: string | undefined) => {
		if (name !== undefined) {
			setOption('video', name);
			startSyncing(paneId, 0);
		}
	};
	return {
		addFile,
		choose: () => void chooseVideoFile(paneId).then(addFile),
		dropProps: {
			onDragOver: (event: DragEvent) => {
				const item = event.dataTransfer.items[0];
				if (item?.kind === 'file') {
					event.preventDefault();
					// Keeps the window from opening it as a log
					event.stopPropagation();
					event.dataTransfer.dropEffect = 'copy';
				}
			},
			onDrop: (event: DragEvent) => {
				const file = event.dataTransfer.files[0];
				if (file && isVideoFile(file)) {
					event.preventDefault();
					event.stopPropagation();
					// The handle has to be requested before the event ends
					const handle = supportsFileHandles ? event.dataTransfer.items[0]?.getAsFileSystemHandle?.() : undefined;
					addFile(dropVideoFile(paneId, file, handle));
				}
			},
		},
	};
}
