import type { Draggable, Droppable } from '@dnd-kit/dom';
import { useDragDropMonitor, useDragOperation } from '@dnd-kit/react';
import { useHotkey } from '@tanstack/react-hotkeys';
import { useSelector } from '@tanstack/react-store';
import PanelRightCloseIcon from 'lucide-react/icons/panel-right-close';
import PanelRightOpenIcon from 'lucide-react/icons/panel-right-open';
import SearchIcon from 'lucide-react/icons/search';
import XIcon from 'lucide-react/icons/x';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Panel, Separator, usePanelRef } from 'react-resizable-panels';
import { EntryRows } from '@/entries/entry-browser-rows';
import { EntryRowsTooltip } from '@/entries/entry-row';
import { ActiveSection } from '@/entries/active-section';
import { HiddenSection } from '@/entries/hidden-section';
import { type EditedWidget, hiddenEntriesNote, useEditedWidget } from '@/entries/edited-widget';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipLabel } from '@/components/tooltip-label';
import { shortcuts } from '@/commands/commands';
import { isEnterKey } from '@/lib/keyboard';
import type { Dashboard } from '@/dashboards/dashboards';
import { type Entry, useEntries } from '@/data/data-store';
import { useSource } from '@/data/source';
import type { EntryDragData, EntrySectionDropData } from '@/entries/drag';
import { useSearchExpansion } from '@/entries/search-expansion';
import { entryPlacementsStore, moveToSection } from '@/entries/sections';
import {
	ancestorGroups,
	buildEntryTree,
	collapseSearchGroups,
	type EntryTreeNode,
	type EntryTreeView,
	entryTreeView,
	expandedGroups,
	sectionEntryTree,
	toggledGroups,
} from '@/entries/tree';
import {
	entryBrowserOpenStore,
	focusEntrySearch,
	searchFocusStore,
	stopEditing,
	toggleEntryBrowser,
} from '@/entries/editing';
import { createPersistedAtom } from '@/lib/persisted-store';
import { dragRegion } from '@/desktop/title-bar';
import { acceptsEntry, type WidgetType } from '@/widgets/widget-type';
import * as z from 'zod';

const defaultWidthPx = 320;
const widthPxStore = createPersistedAtom('entry-browser-width', z.number().positive(), defaultWidthPx, {
	perWindow: true,
});

export function EntryBrowser({ dashboard }: { dashboard: Dashboard }) {
	const open = useSelector(entryBrowserOpenStore);
	useHotkey(shortcuts.toggleEntryBrowser, toggleEntryBrowser, { requireReset: true });
	useHotkey(shortcuts.searchEntries, focusEntrySearch);
	const edited = useEditedWidget(dashboard);
	useHotkey('Escape', stopEditing, { enabled: edited !== undefined, ignoreInputs: false, conflictBehavior: 'allow' });
	const panelRef = usePanelRef();

	if (!open) {
		return (
			// Padded like the header below
			<aside aria-label="Entry browser" className="ms-1.5 shrink-0 px-1.5 pt-3 pb-1.5">
				<ToggleButton open={false} />
			</aside>
		);
	}

	return (
		<>
			<Separator
				aria-label="Resize entry browser"
				// Covers the library's 10px hit area so double-clicks land on the separator
				className="relative z-10 w-1.5 outline-none before:absolute before:inset-x-0.5 before:inset-y-1 before:rounded-full before:transition-colors after:absolute after:inset-y-0 after:-inset-x-0.5 focus-visible:before:bg-ring data-[separator=active]:before:bg-ring data-[separator=hover]:before:bg-ring capture:before:hidden"
				// The built-in reset would use the saved width
				disableDoubleClick
				onDoubleClick={() => panelRef.current?.resize(defaultWidthPx)}
			/>
			<Panel
				panelRef={panelRef}
				defaultSize={widthPxStore.get()}
				minSize="7rem"
				groupResizeBehavior="preserve-pixel-size"
				// Skip the initial mount, which may be clamped to fit a small window
				onResize={(size, _id, prevSize) => prevSize && widthPxStore.set(size.inPixels)}
			>
				{/* Not selectable, so double-clicking or dragging rows doesn't select their labels */}
				{/* A sidebar like the one on the left, on the frame instead of its own surface */}
				<aside aria-label="Entry browser" className="group/entry-browser flex h-full flex-col overflow-hidden">
					{/* Reaches the top of the main area like the sidebar, so it's padded to line up with the pane headers below the dashboard's gap */}
					<div {...dragRegion} className="flex h-10.5 shrink-0 items-center gap-1 ps-3 pe-1.5 pt-1.5">
						{edited ? (
							<>
								<h2 className="min-w-0 flex-1 truncate font-heading text-sm font-medium">Editing {edited.type.name}</h2>
								<Tooltip>
									<TooltipTrigger
										render={<Button variant="ghost" size="icon-xs" aria-label="Stop editing" onClick={stopEditing} />}
									>
										<XIcon />
									</TooltipTrigger>
									<TooltipPopup>
										<TooltipLabel label="Stop editing" shortcut="Escape" />
									</TooltipPopup>
								</Tooltip>
							</>
						) : (
							<>
								<h2 className="flex-1 font-heading text-sm font-medium text-muted-foreground">Entries</h2>
								<ToggleButton open />
							</>
						)}
					</div>
					<EntryTree edited={edited} />
				</aside>
			</Panel>
		</>
	);
}

function ToggleButton({ open }: { open: boolean }) {
	const label = open ? 'Hide entry browser' : 'Show entry browser';
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button variant="ghost" size="icon-xs" aria-label={label} aria-expanded={open} onClick={toggleEntryBrowser} />
				}
			>
				{open ? <PanelRightCloseIcon /> : <PanelRightOpenIcon />}
			</TooltipTrigger>
			<TooltipPopup>
				<TooltipLabel label={label} shortcut={shortcuts.toggleEntryBrowser} />
			</TooltipPopup>
		</Tooltip>
	);
}

/** Search requests already handled, so a remounted search box doesn't focus itself again */
let handledSearchFocus = 0;

function EntryTree({ edited }: { edited: EditedWidget | undefined }) {
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
	const [searchCollapsed, changeSearchExpansion] = useSearchExpansion(deferredQuery);
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
	const view = useMemo(() => collapseSearchGroups(results, searchCollapsed), [results, searchCollapsed]);
	const dropTarget = dropSection === draggedFrom ? undefined : dropSection;

	const message = emptyMessage(source !== undefined, allEntries, entries, editedType, results);

	return (
		<>
			<div className="shrink-0 p-2">
				<InputGroup>
					<InputGroupAddon>
						<SearchIcon />
					</InputGroupAddon>
					<InputGroupInput
						ref={searchRef}
						type="search"
						aria-label="Search entries"
						placeholder="Search entries"
						size="sm"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						onKeyDown={(event) => {
							// Binds or unbinds the first match, even if its group is collapsed
							const first = results.highlights && results.rows.find((row) => row.item.entry)?.item.entry;
							if (isEnterKey(event) && edited && first) {
								edited.setBound(first.name, !edited.bound.includes(first.name));
							}
						}}
					/>
				</InputGroup>
			</div>
			<EntryRowsTooltip />
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
					searchCollapsed={searchCollapsed}
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
