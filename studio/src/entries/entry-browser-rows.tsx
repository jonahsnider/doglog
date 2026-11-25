import { defaultRangeExtractor, type Range, useVirtualizer } from '@tanstack/react-virtual';
import { Tree } from '@ui-sdk/react/tree';
import { Fragment, useCallback, useMemo, useRef, useState } from 'react';
import { Divider } from '@astryxdesign/core/Divider';
import { spacingVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { EntryRowView, rowHeight, StickyRow } from '@/entries/entry-row';
import type { EntrySection } from '@/entries/sections';
import { changedCheckbox, type EditedWidget, groupEntries } from '@/entries/edited-widget';
import type { GroupCheck } from '@/entries/value-marks';
import { ancestorGroups, type EntryTreeNode, type EntryTreeRow, type EntryTreeView } from '@/entries/tree';

const styles = stylex.create({
	container: { position: 'relative', display: 'flex', flexDirection: 'column' },
	scroller: { minHeight: 0, overflowY: 'auto', paddingBottom: spacingVars['--spacing-2'] },
	tree: { position: 'relative' },
	divider: { position: 'absolute', insetInline: 0 },
	sticky: { position: 'absolute', insetInline: 0, top: 0, zIndex: 10 },
});

/** Only renders the rows scrolled into view, logs can have thousands of entries */
export function EntryRows({
	view,
	label,
	xstyle,
	dropSection,
	edited,
	onExpandedChange,
}: {
	view: EntryTreeView;
	label: string;
	/** Sizes the scrolling container */
	xstyle: stylex.StyleXStyles;
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
	const groups = useMemo(() => groupEntries(view.items), [view.items]);
	const groupCheck = (value: string): GroupCheck | undefined => {
		const entries = edited && groups.get(value);
		if (!entries || entries.length === 0) {
			return undefined;
		}
		const count = entries.filter(({ name }) => bound.has(name)).length;
		return count === 0 ? 'unchecked' : count === entries.length ? 'checked' : 'partial';
	};
	// Fully checked groups are checked in the tree too, so unchecking one is a change it reports
	const checkedGroups = new Set([...groups.keys()].filter((value) => groupCheck(value) === 'checked'));
	const container = useRef<HTMLDivElement>(null);
	// Index of the row keyboard focus moved to, see `rangeExtractor`
	const [highlighted, setHighlighted] = useState(0);
	// react-doctor-disable-next-line react-hooks-js/incompatible-library -- React Compiler skips this component rather than memoizing the mutable virtualizer
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

	const stickyHeight = sticky.length > 0 ? Math.max(...sticky.map(({ top }) => top + rowHeight)) : 0;

	return (
		<div {...stylex.props(styles.container, xstyle)}>
			<div
				ref={container}
				{...stylex.props(styles.scroller)}
				// Hides the rows scrolled under the pinned groups, which have no background so they match the frame even when it's translucent
				style={
					stickyHeight > 0
						? { maskImage: `linear-gradient(transparent ${stickyHeight}px, black ${stickyHeight}px)` }
						: undefined
				}
			>
				<Tree
					aria-label={label}
					mode="none"
					items={view.items}
					expanded={view.expanded}
					onExpandedChange={onExpandedChange}
					checkable={edited !== undefined}
					checkStrategy="independent"
					checked={edited ? [...edited.bound, ...checkedGroups] : []}
					onCheckedChange={(checked) => {
						const now = new Set(checked);
						const group = [...groups.keys()].find((value) => now.has(value) !== checkedGroups.has(value));
						if (group !== undefined) {
							// A partly checked group checks the rest of its entries
							edited!.setBound(
								groups.get(group)!.map(({ name }) => name),
								now.has(group),
							);
							return;
						}
						const change = changedCheckbox(edited!.bound, checked, entryNames);
						if (change) {
							edited!.setBound([change.name], change.checked);
						}
					}}
					onAction={(value) => {
						// Clicking or pressing Enter on an entry toggles it too
						if (edited && entryNames.has(value)) {
							edited.setBound([value], !edited.bound.includes(value));
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
					{...stylex.props(styles.tree)}
					style={{ height: virtualizer.getTotalSize() }}
				>
					{virtualizer.getVirtualItems().map((item) => {
						const row = rows[item.index]!;
						return (
							<Fragment key={row.item.value}>
								{row.section === 'main' && rows[item.index - 1]?.section === 'pinned' && (
									<Divider aria-hidden xstyle={styles.divider} style={{ top: item.start }} />
								)}
								<EntryRowView
									row={row}
									top={item.start}
									highlights={highlights?.get(row.item.value)}
									dropTarget={row.section === dropSection}
									editing={edited !== undefined}
									bound={isBound(row.item, bound)}
									containsBound={
										row.item.field === undefined && !groups.has(row.item.value) && boundGroups.has(row.item.value)
									}
									groupCheck={groupCheck(row.item.value)}
									group={groups.get(row.item.value)}
									activeGuide={guideAt(item.index)}
								/>
							</Fragment>
						);
					})}
				</Tree>
			</div>
			{sticky.length > 0 && (
				// Rows in the tree already name these groups to screen readers. Outside the scrolling container so its mask
				// doesn't hide them, which is why scrolling over them is passed on to it.
				<div
					aria-hidden
					{...stylex.props(styles.sticky)}
					style={{ height: stickyHeight }}
					onWheel={(event) => container.current?.scrollBy({ top: event.deltaY })}
				>
					{sticky.map(({ index, top }, depth) => {
						const row = rows[index]!;
						return (
							<StickyRow
								key={row.item.value}
								row={row}
								slot={depth * rowHeight}
								top={top}
								highlights={highlights?.get(row.item.value)}
								bound={isBound(row.item, bound)}
								checked={edited !== undefined && isBound(row.item, bound)}
								containsBound={!groups.has(row.item.value) && boundGroups.has(row.item.value)}
								groupCheck={groupCheck(row.item.value)}
								activeGuide={guideAt(index)}
								// Scroll the group back to where it's pinned
								onClick={() => virtualizer.scrollToOffset((index - depth) * rowHeight)}
							/>
						);
					})}
				</div>
			)}
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
