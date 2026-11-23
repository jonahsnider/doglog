import FileUpIcon from 'lucide-react/icons/file-up';
import { useRef, useState } from 'react';
import { useEventListener } from 'usehooks-ts';
import { draggedFileType, handleLogFileDrop, isLogFile } from '@/data/open-log';
import { useDraggedFile } from '@/desktop/file-drop';

/** Covers the window while a potential log file is dragged over it */
export function LogDropOverlay() {
	const [dragging, setDragging] = useState(false);
	// The desktop app gets file drags from Tauri instead of the browser's drag events
	const draggedFile = useDraggedFile();

	// Entering a child element fires before leaving its parent, so count how deep the drag is
	const depth = useRef(0);

	useEventListener('dragenter', (event) => {
		if (event.dataTransfer?.types.includes('Files') === true) {
			depth.current++;
		}
	});
	useEventListener('dragover', (event) => {
		const transfer = event.dataTransfer;
		const type = draggedFileType(transfer);
		if (!transfer || type === undefined) {
			return;
		}
		// Unknown files may be logs, but don't show a log hint over a widget accepting the drag.
		const log =
			!event.defaultPrevented && (type === '' || type === 'application/x-wpilog' || type === 'application/x-wpilogxz');
		if (!event.defaultPrevented) {
			event.preventDefault();
			transfer.dropEffect = log ? 'copy' : 'none';
		}
		setDragging(log);
	});
	useEventListener('dragleave', (event) => {
		if (event.dataTransfer?.types.includes('Files') === true) {
			depth.current = Math.max(0, depth.current - 1);
			if (depth.current === 0) {
				setDragging(false);
			}
		}
	});
	useEventListener('drop', (event) => {
		depth.current = 0;
		setDragging(false);
		handleLogFileDrop(event);
	});

	if (!dragging && !(draggedFile !== undefined && isLogFile(draggedFile))) {
		return null;
	}

	return (
		<div className="pointer-events-none fixed inset-2 z-50 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary bg-primary/8 text-sm font-medium backdrop-blur-xs">
			<FileUpIcon className="size-6 text-primary" />
			Drop to open log
		</div>
	);
}
