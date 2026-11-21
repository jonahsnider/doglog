import type { GroupImperativeHandle, Layout } from 'react-resizable-panels';
import type { Split } from '@/panes/layout';
import { dividerSize } from '@/panes/pane-size';

/** How close a divider is dragged to another one, or dropped to an even split, for it to snap there, in pixels */
export const snapDistance = 8;

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

function center(element: Element, row: boolean): number {
	const rect = element.getBoundingClientRect();
	return row ? rect.left + rect.width / 2 : rect.top + rect.height / 2;
}

/**
 * While a divider of a split's `group` is dragged, moves it to line up with dividers elsewhere in the dashboard within
 * `snapDistance` of it, and highlights them. Returns whether it's lined up.
 *
 * @param layout The layout the drag would give the group
 * @param minSizes In pixels, the smallest each child of the split can be
 */
export function snapDivider(
	group: HTMLElement | null,
	handle: GroupImperativeHandle | null,
	split: Split,
	layout: Layout,
	minSizes: readonly number[],
): boolean {
	if (!group || !handle) {
		return false;
	}

	const row = split.direction === 'row';
	const separators = Array.from(group.children).filter(
		(element): element is HTMLElement => element instanceof HTMLElement && element.dataset['separator'] !== undefined,
	);
	const index = separators.findIndex((element) => element.dataset['separator'] === 'active');
	const dragged = separators[index];
	const before = split.children[index]?.id;
	const after = split.children[index + 1]?.id;
	const dashboard = group.closest('[data-dashboard-panes]');
	if (!dragged || before === undefined || after === undefined || !dashboard) {
		showGuides(group, []);
		return false;
	}

	// Layouts are percentages of the space the panes share, without the dividers
	const rect = group.getBoundingClientRect();
	const space = (row ? rect.width : rect.height) - separators.length * dividerSize;
	const offset = split.children.slice(0, index + 1).reduce((sum, child) => sum + (layout[child.id] ?? 0), 0);
	const position = (row ? rect.left : rect.top) + (space * offset) / 100 + index * dividerSize + dividerSize / 2;

	// Dividers inside the split move while it's resized, and hidden ones have no size
	const orientation = dragged.getAttribute('aria-orientation');
	const others = Array.from(dashboard.querySelectorAll<HTMLElement>('[data-separator]')).flatMap((element) => {
		const { width, height } = element.getBoundingClientRect();
		return !group.contains(element) &&
			element.getAttribute('aria-orientation') === orientation &&
			width > 0 &&
			height > 0
			? [{ element, center: center(element, row) }]
			: [];
	});
	const target = others.reduce<number | undefined>(
		(nearest, { center: other }) =>
			Math.abs(other - position) <= snapDistance &&
			(nearest === undefined || Math.abs(other - position) < Math.abs(nearest - position))
				? other
				: nearest,
		undefined,
	);
	const delta = target === undefined ? 0 : ((target - position) / space) * 100;
	const beforeSize = (layout[before] ?? 0) + delta;
	const afterSize = (layout[after] ?? 0) - delta;
	if (
		target === undefined ||
		(beforeSize * space) / 100 < (minSizes[index] ?? 0) ||
		(afterSize * space) / 100 < (minSizes[index + 1] ?? 0)
	) {
		showGuides(group, []);
		return false;
	}

	showGuides(
		group,
		others.flatMap(({ element, center: other }) => (Math.abs(other - target) < 1 ? [element] : [])),
	);
	handle.setLayout({ ...layout, [before]: beforeSize, [after]: afterSize });
	return true;
}
