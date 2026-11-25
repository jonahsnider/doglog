import { TextInput } from '@astryxdesign/core/TextInput';
import type { Draggable, Droppable } from '@dnd-kit/dom';
import { useDragDropMonitor, useDragOperation } from '@dnd-kit/react';
import { useSelector } from '@tanstack/react-store';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { shortcuts } from '@/commands/commands';
import { Shortcut } from '@/components/shortcut';
import { type Entry, useEntries } from '@/data/data-store';
import { useSource } from '@/data/source';
import { ActiveSection } from '@/entries/active-section';
import type { EntryDragData, EntrySectionDropData } from '@/entries/drag';
import { type EditedWidget, hiddenEntriesNote } from '@/entries/edited-widget';
import { searchFocusStore } from '@/entries/editing';
import { EntryRows } from '@/entries/entry-browser-rows';
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
import { acceptsEntry, type WidgetType } from '@/widgets/widget-type';
import './entry-browser.css';

/** Search requests already handled, so a remounted search box doesn't focus itself again */
let handledSearchFocus = 0;

export function EntryTree({ edited }: { edited: EditedWidget | undefined }) {
	const mobile = useMobileLayout();
	const source = useSource();
	const allEntries = useEntries();
	const editedType = edited?.type;
	const entries = useMemo(
		() => (editedType ? allEntries.filter((entry) => acceptsEntry(editedType, entry)) : allEntries),
		[allEntries, editedType],
	);
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

	const tree = useMemo(() => buildEntryTree(entries), [entries]);
	// Empty sections are shown while dragging so rows can be dropped in them
	const dragging = draggedFrom !== undefined;
	const sectioned = useMemo(() => sectionEntryTree(tree, placements, dragging), [tree, placements, dragging]);
	if (session?.paneId !== edited?.paneId) {
		setSession(edited && { paneId: edited.paneId, names: edited.bound });
		if (edited) {
			const expanded = [...expandedGroups(sectioned.items, toggled), ...ancestorGroups(edited.bound)];
			setToggled(toggledGroups(sectioned.items, expanded));
		}
	}
	const activeNodes = useMemo((): EntryTreeNode[] => {
		const byName = new Map(entries.map((entry) => [entry.name, entry]));
		return (session?.names ?? []).flatMap((name) => {
			const entry = byName.get(name);
			return entry ? [{ value: name, label: name, entry }] : [];
		});
	}, [session, entries]);
	const results = useMemo(
		() => entryTreeView(sectioned.items, expandedGroups(sectioned.items, toggled), deferredQuery),
		[sectioned, toggled, deferredQuery],
	);
	const view = useMemo(() => toggleSearchGroups(results, searchToggled), [results, searchToggled]);
	const dropTarget = dropSection === draggedFrom ? undefined : dropSection;

	const message = emptyMessage(source !== undefined, allEntries, entries, editedType, results);

	return (
		<>
			{/* The header's height leaves room above, so less top padding keeps the gaps around the search box even */}
			<div className="shrink-0 px-2 pt-1 pb-2">
				<div className="entry-search">
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
						<span aria-hidden className="entry-search-shortcut">
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
					className="min-h-0 flex-1"
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
				<p className="flex-1 px-3 py-2 text-sm text-muted-foreground">{message}</p>
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
				<p className="shrink-0 border-t px-3 py-2 text-xs text-muted-foreground">
					{hiddenEntriesNote(allEntries, entries, editedType)}
				</p>
			)}
		</>
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
		return 'Open a log or connect to a robot to browse its entries.';
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
