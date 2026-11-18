import type { Draggable, Droppable } from '@dnd-kit/dom';
import { useDragDropMonitor, useDragOperation } from '@dnd-kit/react';
import { useHotkey } from '@tanstack/react-hotkeys';
import { useSelector } from '@tanstack/react-store';
import { PanelRightCloseIcon, PanelRightOpenIcon, SearchIcon, XIcon } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Panel, Separator, usePanelRef } from 'react-resizable-panels';
import { EntryRows, EntryRowsTooltip } from '@/entries/entry-browser-rows';
import { HiddenSection } from '@/entries/hidden-section';
import { type EditedWidget, hiddenEntriesNote, useEditedWidget } from '@/entries/edited-widget';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipLabel } from '@/components/tooltip-label';
import { shortcuts } from '@/commands/commands';
import type { Dashboard } from '@/dashboards/dashboards';
import { useEntries } from '@/data/data-store';
import { useSource } from '@/data/source';
import type { EntryDragData, EntrySectionDropData } from '@/entries/drag';
import { entryPlacementsStore, moveToSection } from '@/entries/sections';
import { buildEntryTree, entryTreeView, expandedGroups, sectionEntryTree, toggledGroups } from '@/entries/tree';
import {
	entryBrowserOpenStore,
	focusEntrySearch,
	searchFocusStore,
	stopEditing,
	toggleEntryBrowser,
} from '@/entries/editing';
import { createPersistedAtom } from '@/lib/persisted-store';
import { dragRegion } from '@/desktop/title-bar';
import { acceptsEntry } from '@/widgets/widget-type';
import * as z from 'zod';

const defaultWidthPx = 320;
const widthPxStore = createPersistedAtom('entry-browser-width', z.number().positive(), defaultWidthPx, {
	perWindow: true,
});

/** Collapsible panel listing every entry of the active source as a searchable tree */
export function EntryBrowser({ dashboard }: { dashboard: Dashboard }) {
	const open = useSelector(entryBrowserOpenStore);
	useHotkey(shortcuts.toggleEntryBrowser, toggleEntryBrowser, { requireReset: true });
	useHotkey(shortcuts.searchEntries, focusEntrySearch);
	const edited = useEditedWidget(dashboard);
	useHotkey('Escape', stopEditing, { enabled: edited !== undefined, ignoreInputs: false, conflictBehavior: 'allow' });
	const panelRef = usePanelRef();

	if (!open) {
		return (
			<aside aria-label="Entry browser" className="shrink-0 border-l px-1.5 py-1.5">
				<ToggleButton open={false} />
			</aside>
		);
	}

	return (
		<>
			<Separator
				aria-label="Resize entry browser"
				// Covers the library's 10px hit area so double-clicks land on the separator
				className="relative z-10 w-px bg-border after:absolute after:inset-y-0 after:-inset-x-[4.5px] outline-none transition-colors focus-visible:bg-ring data-[separator=active]:bg-ring data-[separator=hover]:bg-ring"
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
				<aside aria-label="Entry browser" className="flex h-full flex-col select-none">
					<div {...dragRegion} className="flex h-9 shrink-0 items-center gap-1 border-b ps-3 pe-1.5">
						{edited ? (
							<>
								<h2 className="min-w-0 flex-1 truncate text-xs font-medium">Editing {edited.type.name}</h2>
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
								<h2 className="flex-1 text-xs font-medium text-muted-foreground">Entries</h2>
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
	// While editing, entries the widget can't show are left out
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
	// Groups expanded or collapsed by the user, top-level groups start expanded
	const [toggled, setToggled] = useState<ReadonlySet<string>>(new Set());
	const placements = useSelector(entryPlacementsStore);
	const drag = useDragOperation<
		EntryDragData | EntrySectionDropData,
		Draggable<EntryDragData>,
		Droppable<EntrySectionDropData>
	>();
	// Only set while dragging a row of the entry browser
	const draggedFrom = drag.source?.data.section;
	const dropSection = draggedFrom === undefined ? undefined : drag.target?.data.section;

	useDragDropMonitor<EntryDragData | EntrySectionDropData, Draggable<EntryDragData>, Droppable<EntrySectionDropData>>({
		onDragEnd: ({ operation, canceled }) => {
			const from = operation.source?.data.section;
			const to = operation.target?.data.section;
			if (!canceled && from !== undefined && to !== undefined && to !== from) {
				moveToSection(operation.source!.data.name, to);
			}
		},
	});

	const tree = useMemo(() => buildEntryTree(entries), [entries]);
	// Empty sections are shown while dragging so rows can be dropped in them
	const dragging = draggedFrom !== undefined;
	const sectioned = useMemo(() => sectionEntryTree(tree, placements, dragging), [tree, placements, dragging]);
	const view = useMemo(
		() => entryTreeView(sectioned.items, expandedGroups(sectioned.items, toggled), deferredQuery),
		[sectioned, toggled, deferredQuery],
	);
	// Moving a row within its own section does nothing
	const dropTarget = dropSection === draggedFrom ? undefined : dropSection;

	let message: string | undefined;
	if (!source) {
		message = 'Open a log or connect to a robot to browse its entries.';
	} else if (allEntries.length === 0) {
		message = 'No entries yet.';
	} else if (entries.length === 0) {
		message = `No entries the ${editedType!.name.toLowerCase()} can show.`;
	} else if (view.rows.length === 0 && view.highlights !== undefined) {
		message = 'No matching entries.';
	}

	return (
		<>
			<div className="shrink-0 p-2 select-text">
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
							// Binds or unbinds the first match, like picking it
							const first = view.highlights && view.rows.find((row) => row.item.entry)?.item.entry;
							if (event.key === 'Enter' && edited && first) {
								edited.setBound(first.name, !edited.bound.includes(first.name));
							}
						}}
					/>
				</InputGroup>
			</div>
			<EntryRowsTooltip />
			{message === undefined ? (
				<EntryRows
					view={view}
					label="Entries"
					className="min-h-0 flex-1"
					dropSection={dropTarget}
					edited={edited}
					// Every group stays expanded while searching
					onExpandedChange={(next) => {
						if (view.highlights === undefined) {
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
