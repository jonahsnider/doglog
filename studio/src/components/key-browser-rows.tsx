import { useDraggable } from '@dnd-kit/react';
import { useParams } from '@tanstack/react-router';
import { defaultRangeExtractor, type Range, useVirtualizer } from '@tanstack/react-virtual';
import { Tree, TreeItem, TreeItemIndicator, TreeItemLabel } from '@ui-sdk/react/tree';
import { BanIcon, ChevronRightIcon } from 'lucide-react';
import { memo, useCallback, useRef, useState } from 'react';
import { AppContextMenu, type MenuEntry } from '@/components/app-context-menu';
import { HighlightedText } from '@/components/highlighted-text';
import { TooltipCreateHandle, TooltipTrigger } from '@/components/ui/tooltip';
import { MarkTooltip, TypeMark } from '@/components/value-marks';
import { addDashboardWidget } from '@/dashboards';
import { type Entry, useDataVersion } from '@/data/data-store';
import { formatValue, formatValueForCopy } from '@/data/format-value';
import { type EntryDragData, entryDragType } from '@/entry-drag';
import type { KeyRow, KeyTreeView } from '@/key-tree';
import { cn } from '@/lib/utils';
import { getCursorTime, useCursorTime } from '@/timeline';
import { defaultWidget } from '@/widgets/registry';

/** Rows have a fixed height so only the rows in view need to be rendered */
const rowHeight = 28;
/** Shared by the type, boolean, and unsupported marks of every row */
const markTooltip = TooltipCreateHandle<string>();

/** Only renders the rows scrolled into view, logs can have thousands of entries */
export function KeyRows({
	view,
	onExpandedChange,
}: {
	view: KeyTreeView;
	onExpandedChange: (expanded: string[]) => void;
}) {
	const { rows, highlights } = view;
	const container = useRef<HTMLDivElement>(null);
	// Index of the row keyboard focus moved to, see `rangeExtractor`
	const [highlighted, setHighlighted] = useState(0);
	// oxlint-disable-next-line react/incompatible-library -- React Compiler isn't used, and rows only take `item.start`
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

	return (
		<>
			<MarkTooltip handle={markTooltip} />
			<div ref={container} className="min-h-0 flex-1 overflow-y-auto pb-2">
				<Tree
					aria-label="Entries"
					mode="none"
					items={view.items}
					expanded={view.expanded}
					onExpandedChange={onExpandedChange}
					onHighlight={(_value, { index }) => {
						if (index >= 0) {
							setHighlighted(index);
							virtualizer.scrollToIndex(index);
						}
					}}
					className="relative"
					style={{ height: virtualizer.getTotalSize() }}
				>
					{virtualizer.getVirtualItems().map((item) => {
						const row = rows[item.index]!;
						const { entry } = row.item;
						return (
							<KeyRowView
								key={row.item.value}
								row={row}
								top={item.start}
								highlights={entry && highlights?.get(entry.name)}
							/>
						);
					})}
				</Tree>
			</div>
		</>
	);
}

const unsupportedLabel = "Unsupported type, can't be shown in widgets";

// Memoized so rows don't re-render when the cursor moves, only their values do
const KeyRowView = memo(function KeyRowView({
	row,
	top,
	highlights,
}: {
	row: KeyRow;
	top: number;
	highlights: readonly number[] | undefined;
}) {
	const { dashboardId } = useParams({ from: '/dashboards/$dashboardId' });
	const { item: node, level } = row;
	const { entry } = node;
	const unsupported = entry?.kind === 'unsupported';
	const draggable = entry !== undefined && !unsupported;
	const widget = entry && defaultWidget(entry);
	const add = widget && (() => addDashboardWidget(dashboardId, widget));
	const { ref } = useDraggable<EntryDragData>({
		id: node.value,
		type: entryDragType,
		disabled: !draggable,
		...(entry && { data: { entry } }),
	});
	const label = (
		<TooltipTrigger
			handle={markTooltip}
			payload={node.value}
			render={<span className={cn('min-w-24 flex-1 truncate', unsupported && 'text-muted-foreground')} />}
		>
			<HighlightedText text={node.label} ranges={highlights} />
		</TooltipTrigger>
	);
	const typeMark = entry && <TypeMark type={entry.type} tooltip={markTooltip} />;
	const menuItems: MenuEntry[] = entry
		? [
				{ label: 'Add to dashboard', disabled: !add, onSelect: () => add?.() },
				{ label: 'Copy name', onSelect: () => void navigator.clipboard.writeText(entry.name) },
				{ label: 'Copy value', disabled: unsupported, onSelect: () => copyValue(entry) },
			]
		: [];

	return (
		<AppContextMenu
			items={menuItems}
			// Groups that aren't entries keep the browser's menu
			disabled={!entry}
			render={
				<TreeItem
					value={node.value}
					// Without an element, rows that can't be dragged don't get dnd-kit's drag handle attributes
					ref={draggable ? ref : undefined}
					className={cn(
						// Not selectable, so double-clicking doesn't select the label
						'absolute inset-x-0 flex items-center gap-1.5 pe-3 text-sm outline-none select-none hover:bg-accent focus-visible:bg-accent',
						draggable && 'cursor-grab active:cursor-grabbing',
					)}
					style={{ top, height: rowHeight, paddingInlineStart: 8 + (level - 1) * 12 }}
					onDoubleClick={add}
				/>
			}
		>
			<TreeItemLabel className="flex h-full min-w-0 flex-1 items-center gap-1.5">
				{node.children && (
					<TreeItemIndicator className="shrink-0 text-muted-foreground transition-transform data-expanded:rotate-90">
						<ChevronRightIcon className="size-4" />
					</TreeItemIndicator>
				)}
				{typeMark}
				{label}
			</TreeItemLabel>
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

/** Copies the value at the cursor, read when chosen since rows don't re-render as the cursor moves */
function copyValue(entry: Entry): void {
	const time = getCursorTime();
	const value = time === undefined ? undefined : entry.samples.valueAt(time);
	if (value !== undefined) {
		void navigator.clipboard.writeText(formatValueForCopy(value));
	}
}

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
