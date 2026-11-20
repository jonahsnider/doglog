import { defaultRangeExtractor, type Range, useVirtualizer } from '@tanstack/react-virtual';
import { Tree } from '@ui-sdk/react/tree';
import { Fragment, useCallback, useMemo, useRef, useState } from 'react';
import { Separator } from '@/components/ui/separator';
import { EntryRowView, rowHeight, StickyRow } from '@/entries/entry-row';
import type { EntrySection } from '@/entries/sections';
import { changedCheckbox, type EditedWidget } from '@/entries/edited-widget';
import { ancestorGroups, type EntryTreeNode, type EntryTreeRow, type EntryTreeView } from '@/entries/tree';
import { cn } from '@/lib/utils';

/** Only renders the rows scrolled into view, logs can have thousands of entries */
export function EntryRows({
	view,
	label,
	className,
	dropSection,
	edited,
	onExpandedChange,
}: {
	view: EntryTreeView;
	label: string;
	/** Sizes the scrolling container */
	className: string;
	/** The section a row dragged from the entry browser would be moved to */
	dropSection: EntrySection | undefined;
	/** The widget whose entries are being edited, its entries get checkboxes that bind them */
	edited: EditedWidget | undefined;
	onExpandedChange: (expanded: string[]) => void;
}) {
	const { rows, highlights } = view;
	const entryNames = new Set(rows.flatMap((row) => (row.item.entry ? [row.item.value] : [])));
	const bound = new Set(edited?.bound);
	const boundGroups = ancestorGroups(bound);
	const container = useRef<HTMLDivElement>(null);
	// Index of the row keyboard focus moved to, see `rangeExtractor`
	const [highlighted, setHighlighted] = useState(0);
	// oxlint-disable-next-line react/incompatible-library -- React Compiler skips this component rather than memoizing the mutable virtualizer
	const virtualizer = useVirtualizer({
		count: rows.length,
		getScrollElement: () => container.current,
		estimateSize: () => rowHeight,
		// Rows rendered above and below the visible ones, so fast scrolling doesn't show blank space
		overscan: 10,
		useFlushSync: false,
		// The tree only focuses a row that mounts right after a key press, and a focused row that unmounts loses focus.
		// Keep the highlighted row rendered even when it's scrolled out of view.
		rangeExtractor: useCallback(
			(range: Range) => {
				const indexes = defaultRangeExtractor(range);
				if (highlighted < range.count && !indexes.includes(highlighted)) {
					indexes.push(highlighted);
					indexes.sort((a, b) => a - b);
				}
				return indexes;
			},
			[highlighted],
		),
	});

	const families = useMemo(() => rowFamilies(rows), [rows]);
	// Leave room to see the rows under the pinned groups
	const maxSticky = Math.floor((virtualizer.scrollRect?.height ?? 0) / rowHeight / 2);
	const sticky = stickyRows(rows, families, virtualizer.scrollOffset ?? 0, maxSticky);
	// The row last clicked or moved to with the keyboard, whose group's guide is always shown
	const [active, setActive] = useState<string>();
	const guide = useMemo(() => activeGuide(rows, families, active), [rows, families, active]);
	const guideAt = (index: number) => (guide && index >= guide.start && index < guide.end ? guide.level : undefined);

	return (
		<div ref={container} className={cn('relative overflow-y-auto pb-2', className)}>
			{sticky.length > 0 && (
				// Rows in the tree already name these groups to screen readers
				<div aria-hidden className="sticky top-0 z-10 h-0">
					{/* Casts a shadow on the rows scrolling under them */}
					<div
						className="absolute inset-x-0 top-0 bg-sidebar shadow-md"
						style={{ height: Math.max(...sticky.map(({ top }) => top + rowHeight)) }}
					/>
					{sticky.map(({ index, top }, depth) => {
						const row = rows[index]!;
						return (
							<StickyRow
								key={row.item.value}
								row={row}
								top={top}
								// Deeper rows slide out under the ones above them
								zIndex={sticky.length - depth}
								highlights={highlights?.get(row.item.value)}
								bound={isBound(row.item, bound)}
								checked={edited !== undefined && isBound(row.item, bound)}
								containsBound={boundGroups.has(row.item.value)}
								activeGuide={guideAt(index)}
								// Scroll the group back to where it's pinned
								onClick={() => virtualizer.scrollToOffset((index - depth) * rowHeight)}
							/>
						);
					})}
				</div>
			)}
			<Tree
				aria-label={label}
				mode="none"
				items={view.items}
				expanded={view.expanded}
				onExpandedChange={onExpandedChange}
				checkable={edited !== undefined}
				checkStrategy="independent"
				checked={edited ? [...edited.bound] : []}
				onCheckedChange={(checked) => {
					const change = changedCheckbox(edited!.bound, checked, entryNames);
					if (change) {
						edited!.setBound(change.name, change.checked);
					}
				}}
				onAction={(value) => {
					// Clicking or pressing Enter on an entry toggles it too
					if (edited && entryNames.has(value)) {
						edited.setBound(value, !edited.bound.includes(value));
					}
				}}
				onKeyDown={(event) => {
					// Space only toggles checkboxes while editing, it shouldn't scroll the list a page otherwise
					if (event.key === ' ' && !edited) {
						event.preventDefault();
					}
				}}
				onFocus={(event) => {
					const value = event.target.dataset['value'];
					if (value !== undefined) {
						setActive(value);
					}
				}}
				onHighlight={(_value, { index }) => {
					if (index >= 0) {
						setHighlighted(index);
						// Keep the row out from under the pinned groups, which are its ancestors once it's scrolled to the top
						const offset = virtualizer.scrollOffset ?? 0;
						const top = index * rowHeight;
						if (top < offset + sticky.length * rowHeight) {
							virtualizer.scrollToOffset(top - Math.min(rows[index]!.level - 1, maxSticky) * rowHeight);
						} else {
							virtualizer.scrollToIndex(index);
						}
					}
				}}
				className="relative"
				style={{ height: virtualizer.getTotalSize() }}
			>
				{virtualizer.getVirtualItems().map((item) => {
					const row = rows[item.index]!;
					return (
						<Fragment key={row.item.value}>
							{row.section === 'main' && rows[item.index - 1]?.section === 'pinned' && (
								<Separator aria-hidden className="absolute inset-x-0" style={{ top: item.start }} />
							)}
							<EntryRowView
								row={row}
								top={item.start}
								highlights={highlights?.get(row.item.value)}
								dropTarget={row.section === dropSection}
								editing={edited !== undefined}
								bound={isBound(row.item, bound)}
								containsBound={row.item.field === undefined && boundGroups.has(row.item.value)}
								activeGuide={guideAt(item.index)}
							/>
						</Fragment>
					);
				})}
			</Tree>
		</div>
	);
}

/** Index of each row's parent row, -1 at the top level, and the index after each row's last descendant */
function rowFamilies(rows: readonly EntryTreeRow[]): { parents: Int32Array; ends: Int32Array } {
	const parents = new Int32Array(rows.length);
	const ends = new Int32Array(rows.length);
	const open: number[] = [];
	for (const [index, row] of rows.entries()) {
		while (open.length > 0 && rows[open.at(-1)!]!.level >= row.level) {
			ends[open.pop()!] = index;
		}
		parents[index] = open.at(-1) ?? -1;
		open.push(index);
	}
	for (const index of open) {
		ends[index] = rows.length;
	}
	return { parents, ends };
}

/**
 * The rows under the group whose guide is emphasized, as `[start, end)` indexes, and the group's level. The group is
 * the active row when it's an expanded group, or the active row's parent otherwise.
 */
function activeGuide(
	rows: readonly EntryTreeRow[],
	{ parents, ends }: { parents: Int32Array; ends: Int32Array },
	active: string | undefined,
): { start: number; end: number; level: number } | undefined {
	const index = active === undefined ? -1 : rows.findIndex((row) => row.item.value === active);
	if (index < 0) {
		return undefined;
	}
	const group = ends[index]! > index + 1 ? index : parents[index]!;
	return group < 0 ? undefined : { start: group + 1, end: ends[group]!, level: rows[group]!.level };
}

/**
 * Expanded groups scrolled past while their children are still in view, pinned to the top of the list with the deepest
 * last. Each is pushed up as its last child scrolls out from under it.
 */
function stickyRows(
	rows: readonly EntryTreeRow[],
	{ parents, ends }: { parents: Int32Array; ends: Int32Array },
	offset: number,
	max: number,
): { index: number; top: number }[] {
	const sticky: { index: number; top: number }[] = [];
	while (sticky.length < max) {
		const slot = sticky.length * rowHeight;
		const level = sticky.length + 1;
		// The group at this level holding the row under the slot
		let index = Math.floor((offset + slot) / rowHeight);
		while (index >= 0 && index < rows.length && rows[index]!.level > level) {
			index = parents[index]!;
		}
		if (
			index < 0 ||
			index >= rows.length ||
			rows[index]!.level !== level ||
			// Collapsed or not a group
			ends[index] === index + 1 ||
			// Not scrolled under the slot yet
			index * rowHeight >= offset + slot
		) {
			break;
		}
		sticky.push({ index, top: Math.min(slot, (ends[index]! - 1) * rowHeight - offset) });
	}
	return sticky;
}

/** Whether the edited widget shows a row's entry, or the struct field it shows */
function isBound({ entry, field, value }: EntryTreeNode, bound: ReadonlySet<string>): boolean {
	return entry !== undefined && (bound.has(value) || (field !== undefined && bound.has(field.name)));
}
