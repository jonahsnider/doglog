import { type PaneNode, panesAlong, type SplitDirection } from '@/panes/layout';

/** In pixels, the smallest a pane can be made by resizing it, or the desktop window around it, along each direction */
const minPaneSize: Record<SplitDirection, number> = { row: 200, column: 120 };

/** In pixels, the smallest `node` can be along `direction` for each of its panes to be at least `paneSize`, with 1px dividers between them */
export function minNodeSize(node: PaneNode, direction: SplitDirection, paneSize = minPaneSize[direction]): number {
	const count = panesAlong(node, direction);
	return paneSize * count + count - 1;
}

/**
 * In pixels, the smallest each pane of a dashboard `extent` pixels along `direction` can be: a quarter of the dashboard
 * and the minimum pane size, or an even share of the dashboard when it's too small for that
 */
export function minPaneSizeIn(layout: PaneNode, direction: SplitDirection, extent: number): number {
	const count = panesAlong(layout, direction);
	return Math.max((extent - 3) / 4, Math.min(minPaneSize[direction], (extent - count + 1) / count));
}
