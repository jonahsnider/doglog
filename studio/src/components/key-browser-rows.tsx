import { useDraggable } from '@dnd-kit/react';
import { useParams } from '@tanstack/react-router';
import { useVirtualizer } from '@tanstack/react-virtual';
import { BanIcon, ChevronRightIcon, CopyIcon, LayoutGridIcon } from 'lucide-react';
import { memo, useRef } from 'react';
import { AppContextMenu, type MenuEntry } from '@/components/app-context-menu';
import { HighlightedText } from '@/components/highlighted-text';
import { TooltipCreateHandle, TooltipTrigger } from '@/components/ui/tooltip';
import { MarkTooltip, TypeMark } from '@/components/value-marks';
import { addDashboardWidget } from '@/dashboards';
import { type Entry, useDataVersion } from '@/data/data-store';
import { formatValue } from '@/data/format-value';
import { type EntryDragData, entryDragType } from '@/entry-drag';
import type { KeyRow } from '@/key-tree';
import { cn } from '@/lib/utils';
import { useCursorTime } from '@/timeline';
import { defaultWidget } from '@/widgets/registry';

/** Rows have a fixed height so only the rows in view need to be rendered */
const rowHeight = 28;
/** Shared by the type, boolean, and unsupported marks of every row */
const markTooltip = TooltipCreateHandle<string>();

/** Only renders the rows scrolled into view, logs can have thousands of entries */
export function KeyRows({ rows, onToggle }: { rows: readonly KeyRow[]; onToggle: (path: string) => void }) {
	const container = useRef<HTMLDivElement>(null);
	// oxlint-disable-next-line react/incompatible-library -- React Compiler isn't used, and rows only take `item.start`
	const virtualizer = useVirtualizer({
		count: rows.length,
		getScrollElement: () => container.current,
		estimateSize: () => rowHeight,
		// Rows rendered above and below the visible ones, so fast scrolling doesn't show blank space
		overscan: 10,
		useFlushSync: false,
	});

	return (
		<>
			<MarkTooltip handle={markTooltip} />
			<div ref={container} className="min-h-0 flex-1 overflow-y-auto pb-2">
				<div className="relative" style={{ height: virtualizer.getTotalSize() }}>
					{virtualizer.getVirtualItems().map((item) => {
						const row = rows[item.index]!;
						return <KeyRowView key={row.node.path} row={row} top={item.start} onToggle={onToggle} />;
					})}
				</div>
			</div>
		</>
	);
}

const unsupportedLabel = "Unsupported type, can't be shown in widgets";

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
	const { dashboardId } = useParams({ from: '/dashboards/$dashboardId' });
	const { node, depth, expanded } = row;
	const { entry } = node;
	const unsupported = entry?.kind === 'unsupported';
	const draggable = entry !== undefined && !unsupported;
	const widget = entry && defaultWidget(entry);
	const add = widget && (() => addDashboardWidget(dashboardId, widget));
	const { ref } = useDraggable<EntryDragData>({
		id: node.path,
		type: entryDragType,
		disabled: !draggable,
		...(entry && { data: { entry } }),
	});
	const label = (
		<TooltipTrigger
			handle={markTooltip}
			payload={node.path}
			render={<span className={cn('min-w-24 flex-1 truncate', unsupported && 'text-muted-foreground')} />}
		>
			<HighlightedText text={node.label} ranges={row.highlights} />
		</TooltipTrigger>
	);
	const typeMark = entry && <TypeMark type={entry.type} tooltip={markTooltip} />;
	const menuItems: MenuEntry[] = entry
		? [
				{ label: 'Add to dashboard', icon: LayoutGridIcon, disabled: !add, onSelect: () => add?.() },
				{ label: 'Copy name', icon: CopyIcon, onSelect: () => void navigator.clipboard.writeText(entry.name) },
			]
		: [];

	return (
		<AppContextMenu
			items={menuItems}
			// Groups that aren't entries keep the browser's menu
			disabled={!entry}
			render={
				<div
					// Without an element, rows that can't be dragged don't get dnd-kit's drag handle attributes
					ref={draggable ? ref : undefined}
					className={cn(
						// Not selectable, so double-clicking doesn't select the label
						'absolute inset-x-0 flex items-center gap-1.5 pe-3 text-sm outline-none select-none hover:bg-accent focus-visible:bg-accent',
						draggable && 'cursor-grab active:cursor-grabbing',
					)}
					style={{ top, height: rowHeight, paddingInlineStart: 8 + depth * 12 }}
					onDoubleClick={add}
				/>
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
					{typeMark}
					{label}
				</button>
			) : (
				<>
					{typeMark}
					{label}
				</>
			)}
			{entry &&
				(unsupported ? (
					<TooltipTrigger
						handle={markTooltip}
						payload={unsupportedLabel}
						render={
							<BanIcon role="img" className="size-3.5 shrink-0 text-muted-foreground" aria-label={unsupportedLabel} />
						}
					/>
				) : (
					<EntryValue entry={entry} />
				))}
		</AppContextMenu>
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
