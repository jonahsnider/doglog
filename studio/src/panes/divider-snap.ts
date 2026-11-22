import { type RefObject, useLayoutEffect } from 'react';
import type { GroupImperativeHandle, Layout } from 'react-resizable-panels';
import { type PaneNode, resetDivider, resizeSplit, type Split } from '@/panes/layout';
import { dividerSize } from '@/panes/pane-size';
import { childSizes, resizeChildren } from '@/panes/split-sizes';

/** How close a divider is dragged to another one, or dropped to an even split, for it to snap there, in pixels */
export const snapDistance = 8;

/** What dragging a split's dividers needs */
type SplitGroup = {
	handle: GroupImperativeHandle | null;
	split: Split;
	/** In pixels, the smallest each child of the split can be */
	minSizes: readonly number[];
};

/** Every split on screen by its group's element, so dividers in line with a dragged one move with it */
const splitGroups = new Map<HTMLElement, SplitGroup>();

/** Lets dividers dragged in other splits move the dividers of the split in `group` in line with them */
export function useSplitGroup(
	group: RefObject<HTMLElement | null>,
	handle: RefObject<GroupImperativeHandle | null>,
	split: Split,
	minSizes: readonly number[],
) {
	useLayoutEffect(() => {
		const element = group.current;
		if (element) {
			splitGroups.set(element, { handle: handle.current, split, minSizes });
		}
		return () => {
			if (element) {
				splitGroups.delete(element);
			}
		};
	});
}

/** A divider of a split, with the layout it's placed by */
type Divider = SplitGroup & { group: HTMLElement; index: number; layout: Layout };

/** The dividers each split's dragged divider lines up with, highlighted as guides until the drag ends */
const guides = new Map<HTMLElement, HTMLElement[]>();

function showGuides(group: HTMLElement, next: HTMLElement[]) {
	for (const guide of guides.get(group) ?? []) {
		delete guide.dataset['snapGuide'];
	}
	for (const guide of next) {
		guide.dataset['snapGuide'] = '';
	}
	guides.set(group, next);
	// Adding the same listener again does nothing
	if (next.length > 0) {
		addEventListener('pointerup', hideGuides, { once: true });
		addEventListener('pointercancel', hideGuides, { once: true });
	}
}

function hideGuides() {
	for (const group of guides.keys()) {
		showGuides(group, []);
	}
	guides.clear();
}

function separatorsOf(group: Element): HTMLElement[] {
	return Array.from(group.children).filter(
		(element): element is HTMLElement => element instanceof HTMLElement && element.dataset['separator'] !== undefined,
	);
}

/** Whether a divider runs top to bottom, between panes side by side */
function isVertical(separator: Element): boolean {
	return separator.getAttribute('aria-orientation') === 'vertical';
}

function center(element: Element, vertical: boolean): number {
	const rect = element.getBoundingClientRect();
	return vertical ? rect.left + rect.width / 2 : rect.top + rect.height / 2;
}

/** The dashboard's dividers in the same direction as `separator`, without hidden ones, which have no size */
function parallelDividers(dashboard: Element, separator: Element): HTMLElement[] {
	return Array.from(dashboard.querySelectorAll<HTMLElement>('[data-separator]')).filter((element) => {
		const { width, height } = element.getBoundingClientRect();
		return isVertical(element) === isVertical(separator) && width > 0 && height > 0;
	});
}

/**
 * The dividers that look like one line with `separator`: parallel ones in line with it, with only a divider across them
 * between their ends. Hidden and disabled dividers aren't included.
 */
export function linkedDividers(separator: HTMLElement): Set<HTMLElement> {
	const dashboard = separator.closest('[data-dashboard-panes]');
	if (!dashboard) {
		return new Set();
	}

	const vertical = isVertical(separator);
	const span = (element: Element) => {
		const rect = element.getBoundingClientRect();
		return vertical ? { start: rect.top, end: rect.bottom } : { start: rect.left, end: rect.right };
	};
	const position = center(separator, vertical);
	let candidates = parallelDividers(dashboard, separator).filter(
		(element) =>
			element !== separator &&
			!element.hasAttribute('aria-disabled') &&
			Math.abs(center(element, vertical) - position) < 1,
	);

	// Grows the line from the separator, one touching divider at a time
	const line = [span(separator)];
	const linked = new Set<HTMLElement>();
	for (let found = true; found;) {
		found = false;
		for (const element of candidates) {
			const { start, end } = span(element);
			if (line.some((other) => start - other.end <= dividerSize + 1 && other.start - end <= dividerSize + 1)) {
				line.push({ start, end });
				linked.add(element);
				found = true;
			}
		}
		candidates = candidates.filter((element) => !linked.has(element));
	}
	return linked;
}

/** Lets the panes beside the dividers in line with `separator` share their space evenly again, see `resetDivider()` */
export function resetLinked(separator: HTMLElement): (layout: PaneNode) => PaneNode {
	const dividers = Array.from(linkedDividers(separator)).flatMap((link) => dividerOf(link) ?? []);
	return (layout) => dividers.reduce((next, { split, index }) => resetDivider(next, split.id, index), layout);
}

function dividerOf(separator: HTMLElement): Divider | undefined {
	const group = separator.parentElement;
	const splitGroup = group && splitGroups.get(group);
	const layout = splitGroup?.handle?.getLayout();
	return group && splitGroup && layout
		? { ...splitGroup, group, index: separatorsOf(group).indexOf(separator), layout }
		: undefined;
}

/** In pixels from the viewport, where a divider is and how far it can move before a pane beside it is too small */
function measure({ group, split, minSizes, index, layout }: Divider) {
	const row = split.direction === 'row';
	const rect = group.getBoundingClientRect();
	const start = row ? rect.left : rect.top;
	// Layouts are percentages of the space the panes share, without the dividers
	const space = (row ? rect.width : rect.height) - (split.children.length - 1) * dividerSize;
	const share = (child: number) => ((layout[split.children[child]?.id ?? ''] ?? 0) * space) / 100;
	const before = split.children.slice(0, index).reduce((sum, _, child) => sum + share(child), 0) + index * dividerSize;
	const position = start + before + share(index) + dividerSize / 2;
	return {
		position,
		space,
		min: start + before + (minSizes[index] ?? 0) + dividerSize / 2,
		max: position + share(index + 1) - (minSizes[index + 1] ?? 0),
	};
}

/** The divider's layout with it moved to `target`, in pixels from the viewport */
function moveTo(divider: Divider, target: number): Layout {
	const { position, space } = measure(divider);
	const before = divider.split.children[divider.index]?.id ?? '';
	const after = divider.split.children[divider.index + 1]?.id ?? '';
	const delta = ((target - position) / space) * 100;
	return {
		...divider.layout,
		[before]: (divider.layout[before] ?? 0) + delta,
		[after]: (divider.layout[after] ?? 0) - delta,
	};
}

/** Whether the next divider drag moves only the divider grabbed, instead of the line it's part of */
let detached = false;
addEventListener(
	'pointerdown',
	(event) => {
		detached = event.altKey;
	},
	true,
);

/** The dividers moving with each split's dragged divider, found when the drag starts */
const drags = new Map<HTMLElement, { separator: HTMLElement; links: Set<HTMLElement> }>();

/**
 * While a divider of a split's `group` is dragged, moves the dividers in line with it along (see `linkedDividers()`),
 * unless Alt was held when the drag started. Moves them to line up with other dividers in the dashboard within
 * `snapDistance` of them, and highlights those. Returns whether they're lined up.
 *
 * @param layout The layout the drag would give the group
 */
export function dragDivider(group: HTMLElement | null, layout: Layout): boolean {
	const { handle, split, minSizes } = (group && splitGroups.get(group)) ?? {};
	if (!group || !handle || !split || !minSizes) {
		return false;
	}

	const separators = separatorsOf(group);
	const index = separators.findIndex((element) => element.dataset['separator'] === 'active');
	const dragged = separators[index];
	const dashboard = group.closest('[data-dashboard-panes]');
	if (!dragged || index >= split.children.length - 1 || !dashboard) {
		drags.delete(group);
		showGuides(group, []);
		return false;
	}

	// The layout's only shown after this, so the dividers are still where the drag started
	let drag = drags.get(group);
	if (drag?.separator !== dragged) {
		drag = { separator: dragged, links: detached ? new Set() : linkedDividers(dragged) };
		drags.set(group, drag);
	}
	const { links } = drag;
	const self: Divider = { handle, split, minSizes, group, index, layout };
	const others = Array.from(links).flatMap((separator) => dividerOf(separator) ?? []);
	// The line stays straight, so it only moves as far as every divider in it can
	const measures = [self, ...others].map((divider) => measure(divider));
	const min = Math.max(...measures.map((measured) => measured.min));
	const max = Math.min(...measures.map((measured) => measured.max));
	const position = measures[0]?.position ?? 0;

	// Dividers inside the split, or in line with it, move with it
	const targets = parallelDividers(dashboard, dragged).flatMap((element) =>
		!group.contains(element) && !links.has(element) ? [{ element, center: center(element, isVertical(dragged)) }] : [],
	);
	const target = targets.reduce<number | undefined>(
		(nearest, { center: other }) =>
			Math.abs(other - position) <= snapDistance &&
			(nearest === undefined || Math.abs(other - position) < Math.abs(nearest - position))
				? other
				: nearest,
		undefined,
	);
	const snapped = target !== undefined && target >= min - 0.01 && target <= max + 0.01;
	showGuides(
		group,
		snapped ? targets.flatMap(({ element, center: other }) => (Math.abs(other - target) < 1 ? [element] : [])) : [],
	);

	const moved = snapped ? target : Math.min(Math.max(position, min), max);
	for (const divider of others) {
		divider.handle?.setLayout(moveTo(divider, moved));
	}
	if (Math.abs(moved - position) > 0.01) {
		handle.setLayout(moveTo(self, moved));
	}
	return snapped;
}

/**
 * When a split's divider drag ends with its children at `sizes`, resized with `snap` (see `resizeChildren()`), resizes
 * the splits whose dividers moved with it to put them in line with where it ends
 */
export function endDrag(
	group: HTMLElement | null,
	sizes: readonly number[],
	snap: number,
): (layout: PaneNode) => PaneNode {
	const drag = group && drags.get(group);
	const splitGroup = group && splitGroups.get(group);
	if (!group || !drag || !splitGroup) {
		return (layout) => layout;
	}
	drags.delete(group);
	const { split, minSizes } = splitGroup;

	// Where the divider ends once it's snapped to an even split
	const shares = childSizes(resizeChildren(split, sizes, snap));
	const ended = Object.fromEntries(split.children.map((child, at) => [child.id, (shares[at] ?? 0) * 100]));
	const index = separatorsOf(group).indexOf(drag.separator);
	const { position } = measure({ handle: null, split, minSizes, group, index, layout: ended });
	const resized = Array.from(drag.links).flatMap((separator) => {
		const divider = dividerOf(separator);
		if (!divider) {
			return [];
		}
		const moved = moveTo(divider, position);
		return [
			{
				splitId: divider.split.id,
				sizes: divider.split.children.map((child) => (moved[child.id] ?? 0) / 100),
				// Within half a pixel of an even split is one
				snap: 0.5 / Math.max(measure(divider).space, 1),
			},
		];
	});
	return (layout) => resized.reduce((next, link) => resizeSplit(next, link.splitId, link.sizes, link.snap), layout);
}
