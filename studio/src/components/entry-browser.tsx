import type { Draggable, Droppable } from '@dnd-kit/dom';
import { useDragDropMonitor, useDragOperation, useDroppable } from '@dnd-kit/react';
import { useHotkey } from '@tanstack/react-hotkeys';
import { useSelector } from '@tanstack/react-store';
import { ChevronRightIcon, PanelRightCloseIcon, PanelRightOpenIcon, SearchIcon } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { Panel, Separator, usePanelRef } from 'react-resizable-panels';
import { EntryRows, EntryRowsTooltip, SectionHeaderLabel } from '@/components/entry-browser-rows';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Separator as Divider } from '@/components/ui/separator';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipLabel } from '@/components/tooltip-label';
import { shortcuts } from '@/commands';
import { useEntries } from '@/data/data-store';
import { useSource } from '@/data/source';
import type { EntryDragData, EntrySectionDropData } from '@/entry-drag';
import { entryPlacementsStore, moveToSection } from '@/entry-sections';
import { buildEntryTree, type EntryTreeNode, entryTreeView, sectionEntryTree } from '@/entry-tree';
import { cn } from '@/lib/utils';
import { createPersistedAtom } from '@/lib/persisted-store';
import { dragRegion } from '@/title-bar';
import * as z from 'zod';

const openStore = createPersistedAtom('entry-browser-open', z.boolean(), true, { perWindow: true });
const defaultWidthPx = 320;
const widthPxStore = createPersistedAtom('entry-browser-width', z.number().positive(), defaultWidthPx, {
	perWindow: true,
});

function toggleOpen(): void {
	openStore.set((open) => !open);
}

/** Collapsible panel listing every entry of the active source as a searchable tree */
export function EntryBrowser() {
	const open = useSelector(openStore);
	useHotkey(shortcuts.toggleEntryBrowser, toggleOpen, { requireReset: true });
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
					<div {...dragRegion} className="flex h-9 shrink-0 items-center border-b ps-3 pe-1.5">
						<h2 className="flex-1 text-xs font-medium text-muted-foreground">Entries</h2>
						<ToggleButton open />
					</div>
					<EntryTree />
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
				render={<Button variant="ghost" size="icon-xs" aria-label={label} aria-expanded={open} onClick={toggleOpen} />}
			>
				{open ? <PanelRightCloseIcon /> : <PanelRightOpenIcon />}
			</TooltipTrigger>
			<TooltipPopup>
				<TooltipLabel label={label} shortcut={shortcuts.toggleEntryBrowser} />
			</TooltipPopup>
		</Tooltip>
	);
}

function EntryTree() {
	const source = useSource();
	const entries = useEntries();
	const [query, setQuery] = useState('');
	// Keep typing responsive while searching thousands of entries
	const deferredQuery = useDeferredValue(query);
	const [expanded, setExpanded] = useState<string[]>(['pinned']);
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
		() => entryTreeView(sectioned.items, expanded, deferredQuery),
		[sectioned, expanded, deferredQuery],
	);
	// Moving a row within its own section does nothing
	const dropTarget = dropSection === draggedFrom ? undefined : dropSection;

	let message: string | undefined;
	if (!source) {
		message = 'Open a log or connect to a robot to browse its entries.';
	} else if (entries.length === 0) {
		message = 'No entries yet.';
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
						type="search"
						aria-label="Search entries"
						placeholder="Search entries"
						size="sm"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
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
					// Every group stays expanded while searching
					onExpandedChange={(next) => {
						if (view.highlights === undefined) {
							setExpanded(next);
						}
					}}
				/>
			) : (
				<p className="flex-1 px-3 py-2 text-sm text-muted-foreground">{message}</p>
			)}
			{(sectioned.hidden.length > 0 || dragging) && (
				<HiddenSection nodes={sectioned.hidden} query={deferredQuery} dropTarget={dropTarget === 'hidden'} />
			)}
		</>
	);
}

/** Hidden entries and groups, collapsed by default and kept at the bottom of the entry browser */
function HiddenSection({ nodes, query, dropTarget }: { nodes: EntryTreeNode[]; query: string; dropTarget: boolean }) {
	const [open, setOpen] = useState(false);
	const [expanded, setExpanded] = useState<string[]>([]);
	const view = useMemo(() => entryTreeView(nodes, expanded, query, 'hidden'), [nodes, expanded, query]);
	const { ref } = useDroppable<EntrySectionDropData>({
		id: 'hidden',
		accept: (source) => source.data['section'] !== undefined,
		data: { section: 'hidden' },
	});

	return (
		<section
			ref={ref}
			aria-label="Hidden entries"
			className={cn('flex max-h-1/2 min-h-0 shrink-0 flex-col', dropTarget && 'bg-primary/8')}
		>
			<Divider />
			<button
				type="button"
				aria-expanded={open}
				className="flex h-7 shrink-0 items-center gap-1.5 ps-2 pe-3 outline-none hover:bg-accent focus-visible:bg-accent"
				onClick={() => setOpen(!open)}
			>
				<ChevronRightIcon
					className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')}
				/>
				{/* Counts matches while searching */}
				<SectionHeaderLabel section="hidden" count={view.items.length} />
			</button>
			{open && (
				<EntryRows
					view={view}
					label="Hidden entries"
					className="min-h-0"
					// The whole section shows where rows will be dropped
					dropSection={undefined}
					onExpandedChange={(next) => {
						if (view.highlights === undefined) {
							setExpanded(next);
						}
					}}
				/>
			)}
		</section>
	);
}
