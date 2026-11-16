import { FileUpIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { useEventListener } from 'usehooks-ts';
import { hasFiles } from '@/data/source';

/** Covers the window while files are dragged over it, dropping them is handled by `handleLogFileDrops` */
export function LogDropOverlay() {
	const [dragging, setDragging] = useState(false);

	// Entering a child element fires before leaving its parent, so count how deep the drag is
	const depth = useRef(0);

	useEventListener('dragenter', (event) => {
		if (hasFiles(event)) {
			depth.current++;
			setDragging(true);
		}
	});
	useEventListener('dragleave', (event) => {
		if (hasFiles(event) && --depth.current === 0) {
			setDragging(false);
		}
	});
	useEventListener('drop', () => {
		depth.current = 0;
		setDragging(false);
	});

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
