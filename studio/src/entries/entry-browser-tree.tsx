import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { colorVars, spacingVars, typeScaleVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import type { Draggable, Droppable } from '@dnd-kit/dom';
import { useDragDropMonitor, useDragOperation } from '@dnd-kit/react';
import { useSelector } from '@tanstack/react-store';
import FileIcon from 'lucide-react/icons/file';
import RadioTowerIcon from 'lucide-react/icons/radio-tower';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { shortcuts, startConnect } from '@/commands/commands';
import { Shortcut } from '@/components/shortcut';
import type { Entry } from '@/data/data-store';
import { chooseLog } from '@/data/open-log';
import { useSource } from '@/data/source';
import { ActiveSection } from '@/entries/active-section';
import type { EntryDragData, EntrySectionDropData } from '@/entries/drag';
import { type EditedWidget, hiddenEntriesNote } from '@/entries/edited-widget';
import { searchFocusStore } from '@/entries/editing';
import { EntryRows } from '@/entries/entry-browser-rows';
import { PartialEntriesContext, useMergedEntries } from '@/entries/entry-sources';
import { HiddenSection } from '@/entries/hidden-section';
import { useSearchExpansion } from '@/entries/search-expansion';
import { entryPlacementsStore, moveToSection } from '@/entries/sections';
import {
	ancestorGroups,
	buildEntryTree,
	toggleSearchGroups,
	type EntryTreeNode,
	type EntryTreeView,
	entryTreeView,
	expandedGroups,
	sectionEntryTree,
	toggledGroups,
} from '@/entries/tree';
import { isEnterKey } from '@/lib/keyboard';
import { useMobileLayout } from '@/lib/mobile-layout';
import { entrySearchMarker } from './markers.stylex';
import { acceptsEntry, type WidgetType } from '@/widgets/widget-type';

const styles = stylex.create({
	// The header's height leaves room above, so less top padding keeps the gaps around the search box even
	search: {
		flexShrink: 0,
		paddingInline: spacingVars['--spacing-2'],
		paddingTop: spacingVars['--spacing-1'],
		paddingBottom: spacingVars['--spacing-2'],
	},
	field: {
		position: 'relative',
	},
	// The search shortcut sits at the end of the empty field, and gives way once it's focused
	shortcut: {
		position: 'absolute',
		insetBlock: 0,
		insetInlineEnd: spacingVars['--spacing-1-5'],
		display: { default: 'flex', [stylex.when.ancestor(':focus-within', entrySearchMarker)]: 'none' },
		alignItems: 'center',
		pointerEvents: 'none',
	},
	rows: {
		flex: 1,
		minHeight: 0,
	},
	message: {
		flex: 1,
		paddingBlock: spacingVars['--spacing-2'],
		paddingInline: spacingVars['--spacing-3'],
		color: colorVars['--color-text-secondary'],
		fontSize: typeScaleVars['--text-label-size'],
		lineHeight: typeScaleVars['--text-label-leading'],
	},
	sourceActions: {
		display: 'flex',
		flexDirection: 'column',
		gap: spacingVars['--spacing-2'],
		marginTop: spacingVars['--spacing-3'],
	},
	note: {
		flexShrink: 0,
		paddingBlock: spacingVars['--spacing-2'],
		paddingInline: spacingVars['--spacing-3'],
		borderTopWidth: 1,
		borderTopStyle: 'solid',
		borderTopColor: colorVars['--color-border'],
		color: colorVars['--color-text-secondary'],
		fontSize: typeScaleVars['--text-supporting-size'],
		lineHeight: '1rem',
	},
});

/** Search requests already handled, so a remounted search box doesn't focus itself again */
let handledSearchFocus = 0;

// react-doctor-disable-next-line react-doctor/no-high-complexity-react-function -- Its branches were inside useMemo() callbacks, which React Doctor doesn't count, until React Compiler took over memoizing them
export function EntryTree({ edited }: { edited: EditedWidget | undefined }) {
	const mobile = useMobileLayout();
	const source = useSource();
	const { entries: allEntries, partial } = useMergedEntries();
	const editedType = edited?.type;
	const entries = editedType ? allEntries.filter((entry) => acceptsEntry(editedType, entry)) : allEntries;
	const [query, setQuery] = useState('');
	const searchRef = useRef<HTMLInputElement>(null);
	const searchFocus = useSelector(searchFocusStore);
	useEffect(() => {
		if (searchFocus !== handledSearchFocus) {
			handledSearchFocus = searchFocus;
			searchRef.current?.focus();
		}
	}, [searchFocus]);
	// Keep typing responsive while searching thousands of entries
	const deferredQuery = useDeferredValue(query);
	const [searchToggled, changeSearchExpansion] = useSearchExpansion(deferredQuery);
	// Groups expanded or collapsed by the user, top-level groups start expanded
	const [toggled, setToggled] = useState<ReadonlySet<string>>(new Set());
	// The entries the edited widget showed when editing it started, see `ActiveSection`
	const [session, setSession] = useState<{ paneId: string; names: readonly string[] }>();
	const placements = useSelector(entryPlacementsStore);
	const drag = useDragOperation<
		EntryDragData | EntrySectionDropData,
		Draggable<EntryDragData>,
		Droppable<EntrySectionDropData>
	>();
	const draggedFrom = drag.source?.data.section;
	const dropSection = draggedFrom === undefined ? undefined : drag.target?.data.section;

	useDragDropMonitor<EntryDragData | EntrySectionDropData, Draggable<EntryDragData>, Droppable<EntrySectionDropData>>({
		onDragEnd: ({ operation, canceled }) => {
			const from = operation.source?.data.section;
			const to = operation.target?.data.section;
			if (!canceled && from !== undefined && to !== undefined && to !== 'active' && to !== from) {
				moveToSection(operation.source!.data.name, to);
			}
		},
	});

	const tree = buildEntryTree(entries);
	// Empty sections are shown while dragging so rows can be dropped in them
	const dragging = draggedFrom !== undefined;
	// oxlint-disable-next-line studio/no-manual-memo -- Without it, React Compiler also reruns this when groups are toggled or another widget is edited
	const sectioned = useMemo(() => sectionEntryTree(tree, placements, dragging), [tree, placements, dragging]);
	if (session?.paneId !== edited?.paneId) {
		setSession(edited && { paneId: edited.paneId, names: edited.bound });
		if (edited) {
			const expanded = [...expandedGroups(sectioned.items, toggled), ...ancestorGroups(edited.bound)];
			setToggled(toggledGroups(sectioned.items, expanded));
		}
	}
	const byName = new Map(entries.map((entry) => [entry.name, entry]));
	const activeNodes = (session?.names ?? []).flatMap((name): EntryTreeNode[] => {
		const entry = byName.get(name);
		return entry ? [{ value: name, label: name, entry }] : [];
	});
	// oxlint-disable-next-line studio/no-manual-memo -- Without it, React Compiler also reruns this while entries are dragged
	const results = useMemo(
		() => entryTreeView(sectioned.items, expandedGroups(sectioned.items, toggled), deferredQuery),
		[sectioned, toggled, deferredQuery],
	);
	const view = toggleSearchGroups(results, searchToggled);
	const dropTarget = dropSection === draggedFrom ? undefined : dropSection;

	const message = emptyMessage(source !== undefined, allEntries, entries, editedType, results);

	return (
		<PartialEntriesContext value={partial}>
			<div {...stylex.props(styles.search)}>
				<div {...stylex.props(entrySearchMarker, styles.field)}>
					<TextInput
						ref={searchRef}
						type="search"
						label="Search entries"
						isLabelHidden
						startIcon="search"
						placeholder="Search entries"
						size="sm"
						width="100%"
						value={query}
						onChange={setQuery}
						onKeyDown={(event) => {
							// Binds or unbinds the first match, even if its group is collapsed
							const first = results.highlights && results.rows.find((row) => row.item.entry)?.item.entry;
							if (isEnterKey(event) && edited && first) {
								edited.setBound([first.name], !edited.bound.includes(first.name));
							}
						}}
					/>
					{!mobile && query === '' && (
						<span aria-hidden {...stylex.props(styles.shortcut)}>
							<Shortcut hotkey={shortcuts.searchEntries} />
						</span>
					)}
				</div>
			</div>
			{edited && <ActiveSection nodes={activeNodes} query={deferredQuery} edited={edited} />}
			{message === undefined ? (
				<EntryRows
					view={view}
					label="Entries"
					xstyle={styles.rows}
					dropSection={dropTarget}
					edited={edited}
					onExpandedChange={(next) => {
						if (view.highlights) {
							changeSearchExpansion(view.expanded, next);
						} else {
							setToggled(toggledGroups(sectioned.items, next));
						}
					}}
				/>
			) : (
				<div {...stylex.props(styles.message)}>
					<p>{message}</p>
					{source === undefined && (
						<div {...stylex.props(styles.sourceActions)}>
							<Button label="Open log" icon={<FileIcon />} size="sm" width="100%" onClick={chooseLog} />
							<Button label="Connect" icon={<RadioTowerIcon />} size="sm" width="100%" onClick={startConnect} />
						</div>
					)}
				</div>
			)}
			{(sectioned.hidden.length > 0 || dragging) && (
				<HiddenSection
					nodes={sectioned.hidden}
					query={deferredQuery}
					searchToggled={searchToggled}
					onSearchExpandedChange={changeSearchExpansion}
					dropTarget={dropTarget === 'hidden'}
					edited={edited}
				/>
			)}
			{editedType && entries.length > 0 && entries.length < allEntries.length && (
				<p {...stylex.props(styles.note)}>{hiddenEntriesNote(allEntries, entries, editedType)}</p>
			)}
		</PartialEntriesContext>
	);
}

function emptyMessage(
	hasSource: boolean,
	allEntries: readonly Entry[],
	entries: readonly Entry[],
	editedType: WidgetType | undefined,
	view: EntryTreeView,
): string | undefined {
	if (!hasSource) {
		return 'No data source.';
	}
	if (allEntries.length === 0) {
		return 'No entries yet.';
	}
	if (entries.length === 0) {
		return `No entries the ${editedType!.name.toLowerCase()} can show.`;
	}
	if (view.rows.length === 0 && view.highlights !== undefined) {
		return 'No matching entries.';
	}
	return undefined;
}
