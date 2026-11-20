import { LogicalSize } from '@tauri-apps/api/dpi';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect } from 'react';
import type { Size } from '@/hooks/use-size';
import type { PaneNode } from '@/panes/layout';
import { minNodeSize } from '@/panes/pane-size';

/** The smallest the window can be on any page, in pixels */
const baseMinSize: Size = { width: 720, height: 480 };

let applied: string | undefined;

/** Keep the desktop window at least `size` in pixels, or the base size when `undefined`. A smaller window is grown to fit. */
function setMinWindowSize(size: Size | undefined): void {
	if (!STUDIO_DESKTOP) {
		return;
	}

	const width = Math.max(baseMinSize.width, Math.ceil(size?.width ?? 0));
	const height = Math.max(baseMinSize.height, Math.ceil(size?.height ?? 0));
	// Called for every frame of a resize, but the size only changes with the layout
	const key = `${width}x${height}`;
	if (key !== applied) {
		applied = key;
		void getCurrentWindow().setMinSize(new LogicalSize(width, height));
	}
}

setMinWindowSize(undefined);

/**
 * Keep the desktop window big enough for each of `layout`'s panes to be its minimum size, with the rest of the app at
 * its current size around the panes, which are `panesSize` in pixels. Does nothing on the web, where pages can't size
 * the browser window.
 */
export function useMinWindowSize(layout: PaneNode, panesSize: Size | undefined): void {
	const minWidth = minNodeSize(layout, 'row');
	const minHeight = minNodeSize(layout, 'column');
	useEffect(() => {
		if (panesSize) {
			setMinWindowSize({
				width: window.innerWidth - panesSize.width + minWidth,
				height: window.innerHeight - panesSize.height + minHeight,
			});
		}
	}, [panesSize, minWidth, minHeight]);
	useEffect(() => () => setMinWindowSize(undefined), []);
}
