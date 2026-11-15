import { FileUpIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { hasFiles } from '@/data/source';

/** Covers the window while files are dragged over it, dropping them is handled by `handleLogFileDrops` */
export function LogDropOverlay() {
	const [dragging, setDragging] = useState(false);

	useEffect(() => {
		// Entering a child element fires before leaving its parent, so count how deep the drag is
		let depth = 0;
		const onDragEnter = (event: DragEvent) => {
			if (hasFiles(event)) {
				depth++;
				setDragging(true);
			}
		};
		const onDragLeave = (event: DragEvent) => {
			if (hasFiles(event) && --depth === 0) {
				setDragging(false);
			}
		};
		const onDrop = () => {
			depth = 0;
			setDragging(false);
		};

		window.addEventListener('dragenter', onDragEnter);
		window.addEventListener('dragleave', onDragLeave);
		window.addEventListener('drop', onDrop);
		return () => {
			window.removeEventListener('dragenter', onDragEnter);
			window.removeEventListener('dragleave', onDragLeave);
			window.removeEventListener('drop', onDrop);
		};
	}, []);

	if (!dragging) {
		return null;
	}

	return (
		<div className="pointer-events-none fixed inset-2 z-50 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary bg-primary/8 text-sm font-medium backdrop-blur-xs">
			<FileUpIcon className="size-6 text-primary" />
			Drop to open log
		</div>
	);
}
