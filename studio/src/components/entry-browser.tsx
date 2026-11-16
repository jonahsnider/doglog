import { useHotkey } from '@tanstack/react-hotkeys';
import { useSelector } from '@tanstack/react-store';
import { PanelRightCloseIcon, PanelRightOpenIcon, SearchIcon } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { Panel, Separator, usePanelRef } from 'react-resizable-panels';
import { EntryRows } from '@/components/entry-browser-rows';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipLabel } from '@/components/tooltip-label';
import { useEntries } from '@/data/data-store';
import { useSource } from '@/data/source';
import { buildEntryTree, entryTreeView } from '@/entry-tree';
import { createPersistedAtom } from '@/lib/persisted-store';
import * as z from 'zod';

const openStore = createPersistedAtom('entry-browser-open', z.boolean(), true);
const defaultWidthPx = 320;
const widthPxStore = createPersistedAtom('entry-browser-width', z.number().positive(), defaultWidthPx);

function toggleOpen(): void {
	openStore.set((open) => !open);
}

const shortcut = 'Mod+Alt+B';

/** Collapsible panel listing every entry of the active source as a searchable tree */
export function EntryBrowser() {
	const open = useSelector(openStore);
	useHotkey(shortcut, toggleOpen, { requireReset: true });
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
				<aside aria-label="Entry browser" className="flex h-full flex-col">
					<div className="flex h-9 shrink-0 items-center border-b ps-3 pe-1.5">
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
				<TooltipLabel label={label} shortcut={shortcut} />
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
	const [expanded, setExpanded] = useState<string[]>([]);

	const tree = useMemo(() => buildEntryTree(entries), [entries]);
	const view = useMemo(() => entryTreeView(tree, expanded, deferredQuery), [tree, expanded, deferredQuery]);

	let message: string | undefined;
	if (!source) {
		message = 'Open a log or connect to a robot to browse its entries.';
	} else if (entries.length === 0) {
		message = 'No entries yet.';
	} else if (view.rows.length === 0) {
		message = 'No matching entries.';
	}

	return (
		<>
			<div className="shrink-0 p-2">
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
			{message === undefined ? (
				<EntryRows
					view={view}
					// Every group stays expanded while searching
					onExpandedChange={(next) => {
						if (view.highlights === undefined) {
							setExpanded(next);
						}
					}}
				/>
			) : (
				<p className="px-3 py-2 text-sm text-muted-foreground">{message}</p>
			)}
		</>
	);
}
