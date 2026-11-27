import { easing } from '@/lib/motion';
import type { PaneNode } from '@/panes/layout';
import { childSizes } from '@/panes/split-sizes';

/** Where a pane is in its dashboard, as shares of the dashboard's width and height */
type Rect = { x: number; y: number; width: number; height: number };

export type PaneRect = Rect & { paneId: string };

const whole: Rect = { x: 0, y: 0, width: 1, height: 1 };

/** Each pane's place in a layout, in reading order like `panes()` */
export function paneRects(node: PaneNode, rect: Rect = whole): PaneRect[] {
	if (node.kind === 'pane') {
		return [{ ...rect, paneId: node.id }];
	}

	const sizes = childSizes(node);
	let start = 0;
	return node.children.flatMap((child, index) => {
		const size = sizes[index] ?? 0;
		const childRect =
			node.direction === 'row'
				? { ...rect, x: rect.x + start * rect.width, width: size * rect.width }
				: { ...rect, y: rect.y + start * rect.height, height: size * rect.height };
		start += size;
		return paneRects(child, childRect);
	});
}

/**
 * Moves the minimap's highlight in `root` to `position`, which is between two panes mid-swipe, wherever they are in the
 * layout. It slides there over `ms` milliseconds.
 */
export function placeMinimapHighlight(
	root: HTMLElement,
	rects: readonly PaneRect[],
	position: number,
	ms: number,
): void {
	const highlight = root.querySelector<HTMLElement>('[data-minimap-highlight]');
	const from = rects[Math.floor(position)];
	const to = rects[Math.ceil(position)];
	if (!highlight || !from || !to) {
		return;
	}
	const along = position - Math.floor(position);
	const between = (start: number, end: number) => `${(start + (end - start) * along) * 100}%`;
	highlight.style.transition =
		ms === 0
			? 'none'
			: ['left', 'top', 'width', 'height']
					.map((property) => `${property} ${ms}ms cubic-bezier(${easing.move.join(', ')})`)
					.join(', ');
	highlight.style.left = between(from.x, to.x);
	highlight.style.top = between(from.y, to.y);
	highlight.style.width = between(from.width, to.width);
	highlight.style.height = between(from.height, to.height);
}

/**
 * Moves the pane bar's highlight in or around `root` to `position`, between two tabs mid-swipe. It slides there over
 * `--pane-duration`, see `pane-bar.css`.
 */
export function placeBarHighlight(root: HTMLElement, position: number): void {
	const bar = root.closest<HTMLElement>('[data-pane-bar]') ?? root.querySelector<HTMLElement>('[data-pane-bar]');
	const tabs = [...(bar?.querySelectorAll<HTMLElement>('[data-tab-value]') ?? [])];
	const from = tabs[Math.floor(position)];
	const to = tabs[Math.ceil(position)];
	if (!bar || !from || !to) {
		return;
	}
	const along = position - Math.floor(position);
	const between = (start: number, end: number) => `${start + (end - start) * along}px`;
	// Measured from the strip the tabs scroll in, which the highlight is drawn on
	bar.style.setProperty('--pane-bar-x', between(from.offsetLeft, to.offsetLeft));
	bar.style.setProperty('--pane-bar-width', between(from.offsetWidth, to.offsetWidth));
	// The tabs just appeared, so the highlight starts where it's placed instead of growing from nothing. Reading its style
	// applies the place before the highlight's transition is turned on.
	if (!Object.hasOwn(bar.dataset, 'placed')) {
		const strip = bar.querySelector('.astryx-tab-strip');
		if (strip) {
			void getComputedStyle(strip, '::before').width;
		}
		bar.dataset['placed'] = '';
	}
}
