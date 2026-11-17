import { useDraggable, useDroppable } from '@dnd-kit/react';
import { useParams } from '@tanstack/react-router';
import { defaultRangeExtractor, type Range, useVirtualizer } from '@tanstack/react-virtual';
import { Tree, TreeItem, TreeItemIndicator, TreeItemLabel } from '@ui-sdk/react/tree';
import { BanIcon, ChevronRightIcon, EyeOffIcon, PinIcon } from 'lucide-react';
import { Fragment, memo, useCallback, useRef, useState } from 'react';
import { AppContextMenu, type MenuEntry } from '@/components/app-context-menu';
import { EntryName } from '@/components/entry-name';
import { HighlightedText } from '@/components/highlighted-text';
import { Separator } from '@/components/ui/separator';
import { TooltipCreateHandle, TooltipTrigger } from '@/components/ui/tooltip';
import { MarkTooltip, TypeMark } from '@/components/value-marks';
import { addDashboardWidget } from '@/dashboard-panes';
import { type Entry, useDataVersion } from '@/data/data-store';
import { formatValue, formatValueForCopy } from '@/data/format-value';
import { type EntryDragData, entryDragType, entryRowDragType, type EntrySectionDropData } from '@/entry-drag';
import { type EntrySection, entryPlacementsStore, moveToSection } from '@/entry-sections';
import type { EntryTreeRow, EntryTreeView } from '@/entry-tree';
import { cn } from '@/lib/utils';
import { getCursorTime, useCursorTime } from '@/timeline';
import { defaultWidget } from '@/widgets/registry';

/** Rows have a fixed height so only the rows in view need to be rendered */
const rowHeight = 28;
/** Shared by the type, boolean, and unsupported marks of every row */
const markTooltip = TooltipCreateHandle<string>();

/** Tooltip of the rows' type, boolean, and unsupported marks, rendered once for every `EntryRows` */
export function EntryRowsTooltip() {
	return <MarkTooltip handle={markTooltip} />;
}

/** Text of a section's header, ex. `Pinned` */
export function SectionHeaderLabel({ section, count }: { section: 'pinned' | 'hidden'; count: number }) {
	const Icon = section === 'pinned' ? PinIcon : EyeOffIcon;
	return (
		<>
			<Icon className="size-3.5 shrink-0 text-muted-foreground" />
			<span className="flex-1 truncate text-start text-xs font-semibold">
				{section === 'pinned' ? 'Pinned' : 'Hidden'}
			</span>
			<span className="text-xs text-muted-foreground tabular-nums">{count}</span>
		</>
	);
}

/** Only renders the rows scrolled into view, logs can have thousands of entries */
export function EntryRows({
	view,
	label,
	className,
	dropSection,
	onExpandedChange,
}: {
	view: EntryTreeView;
	label: string;
	/** Sizes the scrolling container */
	className: string;
	/** The section a row dragged from the entry browser would be moved to */
	dropSection: EntrySection | undefined;
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
		<div ref={container} className={cn('overflow-y-auto pb-2', className)}>
			<Tree
				aria-label={label}
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
					return (
						<Fragment key={row.item.value}>
							{/* Separates the Pinned section from the rest of the tree */}
							{row.section === 'main' && rows[item.index - 1]?.section === 'pinned' && (
								<Separator aria-hidden className="absolute inset-x-0" style={{ top: item.start }} />
							)}
							<EntryRowView
								row={row}
								top={item.start}
								highlights={highlights?.get(row.item.value)}
								dropTarget={row.section === dropSection}
							/>
						</Fragment>
					);
				})}
			</Tree>
		</div>
	);
}

const unsupportedLabel = "Unsupported type, can't be shown in widgets";

// Memoized so rows don't re-render when the cursor moves, only their values do
const EntryRowView = memo(function EntryRowView({
	row,
	top,
	highlights,
	dropTarget,
}: {
	row: EntryTreeRow;
	top: number;
	highlights: readonly number[] | undefined;
	dropTarget: boolean;
}) {
	const { dashboardId } = useParams({ from: '/dashboards/$dashboardId' });
	const { item: node, level, section } = row;
	const { entry } = node;
	const header = node.section !== undefined;
	const unsupported = entry?.kind === 'unsupported';
	const widget = entry && defaultWidget(entry);
	const add = widget && (() => addDashboardWidget(dashboardId, widget));
	const { ref: dragRef } = useDraggable<EntryDragData>({
		id: node.value,
		// Groups and unsupported entries can only be moved between sections
		type: entry && !unsupported ? entryDragType : entryRowDragType,
		disabled: header,
		data: { name: node.value, section },
	});
	const { ref: dropRef } = useDroppable<EntrySectionDropData>({
		id: node.value,
		accept: (source) => source.data['section'] !== undefined,
		data: { section },
	});
	const ref = useCallback(
		(element: Element | null) => {
			dragRef(element);
			dropRef(element);
		},
		[dragRef, dropRef],
	);
	const className = cn(
		// Not selectable, so double-clicking doesn't select the label
		'absolute inset-x-0 flex items-center gap-1.5 pe-3 text-sm outline-none select-none hover:bg-accent focus-visible:bg-accent',
		dropTarget && 'bg-primary/8',
	);
	const style = { top, height: rowHeight, paddingInlineStart: 8 + (level - 1) * 12 };
	const indicator = node.children && (
		<TreeItemIndicator className="shrink-0 text-muted-foreground transition-transform data-expanded:rotate-90">
			<ChevronRightIcon className="size-4" />
		</TreeItemIndicator>
	);

	if (header) {
		return (
			// Without the drag ref, headers don't get dnd-kit's drag handle attributes
			<TreeItem value={node.value} ref={dropRef} className={className} style={style}>
				<TreeItemLabel className="flex h-full min-w-0 flex-1 items-center gap-1.5">
					{indicator}
					<SectionHeaderLabel section="pinned" count={node.children?.length ?? 0} />
				</TreeItemLabel>
			</TreeItem>
		);
	}

	const label = (
		<TooltipTrigger
			handle={markTooltip}
			payload={node.value}
			render={<span className={cn('min-w-24 flex-1 truncate', unsupported && 'text-muted-foreground')} />}
		>
			{/* The tops of pinned and hidden entries and groups are labeled with their full paths */}
			{node.label === node.value ? (
				<EntryName name={node.value} ranges={highlights} />
			) : (
				<HighlightedText text={node.label} ranges={highlights} />
			)}
		</TooltipTrigger>
	);
	const typeMark = entry && <TypeMark type={entry.type} tooltip={markTooltip} />;
	const menuItems = (): MenuEntry[] => [
		...(entry
			? ([
					{ label: 'Add to dashboard', disabled: !add, onSelect: () => add?.() },
					{ label: 'Copy name', onSelect: () => void navigator.clipboard.writeText(entry.name) },
					{ label: 'Copy value', disabled: unsupported, onSelect: () => copyValue(entry) },
					'separator',
				] satisfies MenuEntry[])
			: []),
		...sectionMenuItems(node.value, section),
	];

	return (
		<AppContextMenu
			items={menuItems}
			render={
				<TreeItem
					value={node.value}
					ref={ref}
					className={cn(className, 'cursor-grab active:cursor-grabbing')}
					style={style}
					onDoubleClick={add}
				/>
			}
		>
			<TreeItemLabel className="flex h-full min-w-0 flex-1 items-center gap-1.5">
				{indicator}
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

/**
 * Pin and hide actions for a row in `section`. Entries and groups in a pinned or hidden group are moved with it,
 * so they can only be moved to the other section.
 */
function sectionMenuItems(path: string, section: EntrySection): MenuEntry[] {
	const placement = entryPlacementsStore.get()[path];
	const items: MenuEntry[] = [];
	if (placement === 'pinned') {
		items.push({ label: 'Unpin', onSelect: () => moveToSection(path, 'main') });
	} else if (section !== 'pinned') {
		items.push({ label: 'Pin', onSelect: () => moveToSection(path, 'pinned') });
	}
	if (placement === 'hidden') {
		items.push({ label: 'Unhide', onSelect: () => moveToSection(path, 'main') });
	} else if (section !== 'hidden') {
		items.push({ label: 'Hide', onSelect: () => moveToSection(path, 'hidden') });
	}
	return items;
}

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
