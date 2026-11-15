import { useDraggable } from '@dnd-kit/react';
import { useFormatForDisplay, useHotkey } from '@tanstack/react-hotkeys';
import { useSelector } from '@tanstack/react-store';
import { BanIcon, ChevronRightIcon, PanelRightCloseIcon, PanelRightOpenIcon, SearchIcon } from 'lucide-react';
import { memo, useCallback, useDeferredValue, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Kbd } from '@/components/ui/kbd';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { type Entry, useDataVersion, useEntries } from '@/data/data-store';
import { formatValue } from '@/data/format-value';
import { useSource } from '@/data/source';
import { type EntryDragData, entryDragType } from '@/entry-drag';
import { buildKeyTree, type KeyRow, visibleKeyRows } from '@/key-tree';
import { createPersistedAtom } from '@/lib/persisted-store';
import { cn } from '@/lib/utils';
import { useCursorTime } from '@/timeline';
import * as z from 'zod';

/** Rows have a fixed height so only the rows in view need to be rendered */
const rowHeight = 28;
/** Rows rendered above and below the visible ones, so fast scrolling doesn't show blank space */
const overscan = 10;

const openStore = createPersistedAtom('key-browser-open', z.boolean(), true);

function toggleOpen(): void {
	openStore.set((open) => !open);
}

const shortcut = 'Mod+Alt+B';

/** Collapsible panel listing every entry of the active source as a searchable tree */
export function KeyBrowser() {
	const open = useSelector(openStore);
	useHotkey(shortcut, toggleOpen, { requireReset: true });

	if (!open) {
		return (
			<aside aria-label="Key browser" className="shrink-0 border-l px-1.5 py-1.5">
				<ToggleButton open={false} />
			</aside>
		);
	}

	return (
		<aside aria-label="Key browser" className="flex w-80 shrink-0 flex-col border-l">
			<div className="flex h-9 shrink-0 items-center border-b ps-3 pe-1.5">
				<h2 className="flex-1 text-xs font-medium text-muted-foreground">Keys</h2>
				<ToggleButton open />
			</div>
			<KeyTree />
		</aside>
	);
}

function ToggleButton({ open }: { open: boolean }) {
	const label = open ? 'Hide key browser' : 'Show key browser';
	const formatForDisplay = useFormatForDisplay();
	return (
		<Tooltip>
			<TooltipTrigger
				render={<Button variant="ghost" size="icon-xs" aria-label={label} aria-expanded={open} onClick={toggleOpen} />}
			>
				{open ? <PanelRightCloseIcon /> : <PanelRightOpenIcon />}
			</TooltipTrigger>
			<TooltipPopup>
				<span className="flex items-center gap-2">
					{label}
					<Kbd>{formatForDisplay(shortcut)}</Kbd>
				</span>
			</TooltipPopup>
		</Tooltip>
	);
}

function KeyTree() {
	const source = useSource();
	const entries = useEntries();
	const [query, setQuery] = useState('');
	// Keep typing responsive while searching thousands of entries
	const deferredQuery = useDeferredValue(query);
	const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

	const tree = useMemo(() => buildKeyTree(entries), [entries]);
	const rows = useMemo(() => visibleKeyRows(tree, expanded, deferredQuery), [tree, expanded, deferredQuery]);

	const toggleGroup = useCallback((path: string) => {
		setExpanded((previous) => {
			const next = new Set(previous);
			if (!next.delete(path)) {
				next.add(path);
			}
			return next;
		});
	}, []);

	let message: string | undefined;
	if (!source) {
		message = 'Open a log or connect to a robot to browse its entries.';
	} else if (entries.length === 0) {
		message = 'No entries yet.';
	} else if (rows.length === 0) {
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
				<VirtualRows rows={rows} onToggle={toggleGroup} />
			) : (
				<p className="px-3 py-2 text-sm text-muted-foreground">{message}</p>
			)}
		</>
	);
}

/** Only renders the rows scrolled into view, logs can have thousands of entries */
function VirtualRows({ rows, onToggle }: { rows: readonly KeyRow[]; onToggle: (path: string) => void }) {
	const container = useRef<HTMLDivElement>(null);
	const [scrollTop, setScrollTop] = useState(0);
	const [height, setHeight] = useState(0);

	useLayoutEffect(() => {
		const element = container.current!;
		setHeight(element.clientHeight);
		const observer = new ResizeObserver(() => setHeight(element.clientHeight));
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	const first = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
	const last = Math.min(rows.length, Math.ceil((scrollTop + height) / rowHeight) + overscan);

	return (
		<div
			ref={container}
			className="min-h-0 flex-1 overflow-y-auto pb-2"
			onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
		>
			<div className="relative" style={{ height: rows.length * rowHeight }}>
				{rows.slice(first, last).map((row, index) => (
					<KeyRowView key={row.node.path} row={row} top={(first + index) * rowHeight} onToggle={onToggle} />
				))}
			</div>
		</div>
	);
}

// Memoized so rows don't re-render when the cursor moves, only their values do
const KeyRowView = memo(function KeyRowView({
	row,
	top,
	onToggle,
}: {
	row: KeyRow;
	top: number;
	onToggle: (path: string) => void;
}) {
	const { node, depth, expanded } = row;
	const { entry } = node;
	const unsupported = entry?.kind === 'unsupported';
	const draggable = entry !== undefined && !unsupported;
	const { ref } = useDraggable<EntryDragData>({
		id: node.path,
		type: entryDragType,
		disabled: !draggable,
		...(entry && { data: { entry } }),
	});
	const label = (
		<span className={cn('min-w-24 flex-1 truncate', unsupported && 'text-muted-foreground')}>{node.label}</span>
	);

	return (
		<div
			// Without an element, rows that can't be dragged don't get dnd-kit's drag handle attributes
			ref={draggable ? ref : undefined}
			className={cn(
				'absolute inset-x-0 flex items-center gap-1.5 pe-3 text-sm outline-none hover:bg-accent focus-visible:bg-accent',
				draggable && 'cursor-grab active:cursor-grabbing',
			)}
			style={{ top, height: rowHeight, paddingInlineStart: 8 + depth * 12 }}
			title={
				entry
					? `${entry.name}\n${entry.type}${unsupported ? " (unsupported, can't be shown in widgets)" : ''}`
					: node.path
			}
		>
			{node.children.length > 0 ? (
				<button
					type="button"
					className="flex h-full min-w-0 flex-1 items-center gap-1.5 text-start outline-none focus-visible:underline"
					aria-expanded={expanded}
					onClick={() => onToggle(node.path)}
				>
					<ChevronRightIcon
						className={cn('size-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-90')}
					/>
					{label}
				</button>
			) : (
				<>
					<span className="size-4 shrink-0" />
					{label}
				</>
			)}
			{entry && <span className="min-w-0 max-w-20 shrink truncate text-xs text-muted-foreground">{entry.type}</span>}
			{entry &&
				(unsupported ? (
					<BanIcon
						role="img"
						className="size-3.5 shrink-0 text-muted-foreground"
						aria-label="Unsupported type, can't be shown in widgets"
					/>
				) : (
					<EntryValue entry={entry} />
				))}
		</div>
	);
});

function EntryValue({ entry }: { entry: Entry }) {
	const time = useCursorTime();
	// Values at the cursor can change as samples arrive, ex. while a log loads
	useDataVersion();
	const value = time === undefined ? undefined : entry.samples.valueAt(time);

	return (
		<span className="min-w-0 max-w-28 shrink truncate text-right font-mono text-xs tabular-nums">
			{formatValue(value)}
		</span>
	);
}
