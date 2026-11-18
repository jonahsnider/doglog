import { useDraggable, useDroppable } from '@dnd-kit/react';
import { useParams } from '@tanstack/react-router';
import { defaultRangeExtractor, type Range, useVirtualizer } from '@tanstack/react-virtual';
import { Tree, TreeItem, TreeItemCheckbox, TreeItemIndicator, TreeItemLabel } from '@ui-sdk/react/tree';
import { CheckIcon, ChevronRightIcon } from 'lucide-react';
import { Fragment, memo, useCallback, useRef, useState } from 'react';
import { AppContextMenu, type MenuEntry } from '@/components/app-context-menu';
import { EntryName } from '@/entries/entry-name';
import { SectionHeaderLabel } from '@/entries/section-header-label';
import { HighlightedText } from '@/components/highlighted-text';
import { Separator } from '@/components/ui/separator';
import { TooltipCreateHandle, TooltipTrigger } from '@/components/ui/tooltip';
import { MarkTooltip, TypeMark } from '@/entries/value-marks';
import { EntryRowValue } from '@/entries/entry-value';
import { entryMenuItems } from '@/entries/entry-menu';
import { addDashboardWidget } from '@/dashboards/panes';
import type { EntryDragData, EntrySectionDropData } from '@/entries/drag';
import { entryDragType, entryRowDragType, entryRowSensors } from '@/entries/drag';
import { type EntrySection, sectionMenuItems } from '@/entries/sections';
import { changedCheckbox, type EditedWidget } from '@/entries/edited-widget';
import { ancestorGroups, type EntryTreeNode, type EntryTreeRow, type EntryTreeView } from '@/entries/tree';
import { cn } from '@/lib/utils';
import { defaultWidget } from '@/widgets/registry';

/** Rows have a fixed height so only the rows in view need to be rendered */
const rowHeight = 28;
/** Shared by the type, boolean, and unsupported marks of every row */
const markTooltip = TooltipCreateHandle<string>();

/** Tooltip of the rows' type, boolean, and unsupported marks, rendered once for every `EntryRows` */
export function EntryRowsTooltip() {
	return <MarkTooltip handle={markTooltip} />;
}

/** Only renders the rows scrolled into view, logs can have thousands of entries */
export function EntryRows({
	view,
	label,
	className,
	dropSection,
	edited,
	onExpandedChange,
}: {
	view: EntryTreeView;
	label: string;
	/** Sizes the scrolling container */
	className: string;
	/** The section a row dragged from the entry browser would be moved to */
	dropSection: EntrySection | undefined;
	/** The widget whose entries are being edited, its entries get checkboxes that bind them */
	edited: EditedWidget | undefined;
	onExpandedChange: (expanded: string[]) => void;
}) {
	const { rows, highlights } = view;
	const entryNames = new Set(rows.flatMap((row) => (row.item.entry ? [row.item.value] : [])));
	const bound = new Set(edited?.bound);
	const boundGroups = ancestorGroups(bound);
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
				checkable={edited !== undefined}
				checkStrategy="independent"
				checked={edited ? [...edited.bound] : []}
				onCheckedChange={(checked) => {
					const change = changedCheckbox(edited!.bound, checked, entryNames);
					if (change) {
						edited!.setBound(change.name, change.checked);
					}
				}}
				onAction={(value) => {
					// Clicking or pressing Enter on an entry toggles it too
					if (edited && entryNames.has(value)) {
						edited.setBound(value, !edited.bound.includes(value));
					}
				}}
				onKeyDown={(event) => {
					// Space only toggles checkboxes while editing, it shouldn't scroll the list a page otherwise
					if (event.key === ' ' && !edited) {
						event.preventDefault();
					}
				}}
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
								editing={edited !== undefined}
								bound={row.item.entry !== undefined && bound.has(row.item.value)}
								containsBound={boundGroups.has(row.item.value)}
							/>
						</Fragment>
					);
				})}
			</Tree>
		</div>
	);
}

// Memoized so rows don't re-render when the cursor moves, only their values do
const EntryRowView = memo(function EntryRowView({
	row,
	top,
	highlights,
	dropTarget,
	editing,
	bound,
	containsBound,
}: {
	row: EntryTreeRow;
	top: number;
	highlights: readonly number[] | undefined;
	dropTarget: boolean;
	/** Entries have checkboxes that bind them to the edited widget, instead of being added to the dashboard by double-clicking */
	editing: boolean;
	/** The edited widget shows this entry */
	bound: boolean;
	/** The edited widget shows entries in this group, marked like VS Code marks folders with changes */
	containsBound: boolean;
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
		sensors: entryRowSensors,
		data: { name: node.value, section },
	});
	const { ref: dropRef } = useDroppable<EntrySectionDropData>({
		id: node.value,
		accept: (source) => source.data['section'] !== undefined,
		// The Active section lists entries again, they can't be moved to it
		disabled: section === 'active',
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
		'absolute inset-x-0 flex items-center gap-1.5 pe-3 text-sm outline-none hover:bg-accent focus-visible:bg-accent',
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

	const menuItems = (): MenuEntry[] => [...entryMenuItems(entry, add), ...sectionMenuItems(node.value, section)];

	return (
		<AppContextMenu
			items={menuItems}
			render={
				<TreeItem
					value={node.value}
					ref={ref}
					className={cn(className, 'cursor-grab active:cursor-grabbing')}
					style={style}
					onDoubleClick={editing ? undefined : add}
				/>
			}
		>
			<TreeItemLabel className="flex h-full min-w-0 flex-1 items-center gap-1.5">
				{indicator}
				{entry && <EntryMarks type={entry.type} editing={editing} />}
				<RowLabel node={node} highlights={highlights} unsupported={unsupported} bound={bound} />
				{containsBound && (
					<span role="img" aria-label="Has active entries" className="size-1.5 shrink-0 rounded-full bg-primary" />
				)}
			</TreeItemLabel>
			{entry && <EntryRowValue entry={entry} tooltip={markTooltip} />}
		</AppContextMenu>
	);
});

function RowLabel({
	node,
	highlights,
	unsupported,
	bound,
}: {
	node: EntryTreeNode;
	highlights: readonly number[] | undefined;
	unsupported: boolean;
	bound: boolean;
}) {
	const className = cn('min-w-24 flex-1 truncate', unsupported && 'text-muted-foreground', bound && 'text-primary');
	return (
		<TooltipTrigger handle={markTooltip} payload={node.value} render={<span className={className} />}>
			{/* The tops of pinned and hidden entries and groups are labeled with their full paths */}
			{node.label === node.value ? (
				<EntryName name={node.value} ranges={highlights} />
			) : (
				<HighlightedText text={node.label} ranges={highlights} />
			)}
		</TooltipTrigger>
	);
}

/** An entry's type, after a checkbox that's checked while the edited widget shows it, see `EditedWidget` */
function EntryMarks({ type, editing }: { type: string; editing: boolean }) {
	return (
		<>
			{editing && <BindCheckbox />}
			<TypeMark type={type} tooltip={markTooltip} />
		</>
	);
}

function BindCheckbox() {
	return (
		<TreeItemCheckbox className="group/checkbox flex size-4 shrink-0 items-center justify-center rounded-[.25rem] border border-input bg-background text-primary-foreground data-checked:border-primary data-checked:bg-primary dark:not-data-checked:bg-input/32">
			<CheckIcon className="size-3 group-not-data-checked/checkbox:hidden" strokeWidth={3} />
		</TreeItemCheckbox>
	);
}
