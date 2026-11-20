import { useDraggable, useDroppable } from '@dnd-kit/react';
import { useParams } from '@tanstack/react-router';
import { TreeItem, TreeItemIndicator, TreeItemLabel } from '@ui-sdk/react/tree';
import ChevronRightIcon from 'lucide-react/icons/chevron-right';
import { memo, useCallback } from 'react';
import { AppContextMenu, type MenuEntry } from '@/components/app-context-menu';
import { EntryName } from '@/entries/entry-name';
import { SectionHeaderLabel } from '@/entries/section-header-label';
import { HighlightedText } from '@/components/highlighted-text';
import { TooltipCreateHandle, TooltipTrigger } from '@/components/ui/tooltip';
import { GroupMark, MarkTooltip, TypeMark } from '@/entries/value-marks';
import { EntryRowValue } from '@/entries/entry-value';
import { entryMenuItems } from '@/entries/entry-menu';
import { addDashboardWidget } from '@/dashboards/panes';
import type { EntryDragData, EntrySectionDropData } from '@/entries/drag';
import { entryDragType, entryRowDragType, entryRowSensors } from '@/entries/drag';
import { sectionMenuItems } from '@/entries/sections';
import type { EntryTreeNode, EntryTreeRow } from '@/entries/tree';
import { cn } from '@/lib/utils';
import { defaultWidget } from '@/widgets/registry';

/** Rows have a fixed height so only the rows in view need to be rendered */
export const rowHeight = 28;
/** Shared by the type, boolean, and unsupported marks of every row */
const markTooltip = TooltipCreateHandle<string>();

/** Tooltip of the rows' type, boolean, and unsupported marks, rendered once for every `EntryRows` */
export function EntryRowsTooltip() {
	return <MarkTooltip handle={markTooltip} />;
}

// Memoized so rows don't re-render when the cursor moves, only their values do
export const EntryRowView = memo(function EntryRowView({
	row,
	top,
	highlights,
	dropTarget,
	editing,
	bound,
	containsBound,
	activeGuide,
}: {
	row: EntryTreeRow;
	top: number;
	highlights: readonly number[] | undefined;
	dropTarget: boolean;
	/** Entries have checkboxes that bind them to the edited widget, instead of being added to the dashboard by double-clicking */
	editing: boolean;
	bound: boolean;
	/** The edited widget shows entries in this group, marked like a folder with changes in a code editor */
	containsBound: boolean;
	/** Level of the group whose guide is emphasized, when the row is in it */
	activeGuide: number | undefined;
}) {
	const { dashboardId } = useParams({ from: '/dashboards/$dashboardId' });
	const { item: node, level, section } = row;
	const { entry, field } = node;
	const header = node.section !== undefined;
	const unsupported = entry?.kind === 'unsupported';
	// Rows showing a struct's only field are added as the value they show
	const shown = field ?? entry;
	const widget = shown && defaultWidget(shown);
	const add = widget && (() => addDashboardWidget(dashboardId, widget));
	const { ref: dragRef } = useDraggable<EntryDragData>({
		id: node.value,
		// Groups and unsupported entries can only be moved between sections
		type: entry && !unsupported ? entryDragType : entryRowDragType,
		disabled: header,
		sensors: entryRowSensors,
		data: { name: node.value, field: field?.name, section },
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
	const className = cn(rowClassName, dropTarget && 'bg-primary/8');
	const style = rowStyle(top, level);

	if (header) {
		return (
			// Without the drag ref, headers don't get dnd-kit's drag handle attributes
			<TreeItem value={node.value} data-value={node.value} ref={dropRef} className={className} style={style}>
				<TreeItemLabel className="flex h-full min-w-0 flex-1 items-center gap-1.5">
					<RowIndicator expandable={node.children !== undefined} />
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
					// Tells the tree which row has focus, see `EntryRows`
					data-value={node.value}
					ref={ref}
					className={cn(className, 'cursor-grab active:cursor-grabbing')}
					style={style}
					onDoubleClick={editing ? undefined : add}
				/>
			}
		>
			<IndentGuides level={level} active={activeGuide} />
			<TreeItemLabel className="flex h-full min-w-0 flex-1 items-center gap-1.5">
				<RowIndicator expandable={node.children !== undefined} />
				{/* Checked while editing instead of having a checkbox of its own, so editing doesn't push the label over */}
				{entry && <TypeMark type={entry.type} tooltip={markTooltip} checked={editing && bound} />}
				<RowLabel node={node} highlights={highlights} unsupported={unsupported} bound={bound} />
				{containsBound && <ContainsBoundMark />}
			</TreeItemLabel>
			{node.children && <GroupMark path={node.value} tooltip={markTooltip} />}
			{shown && <EntryRowValue entry={shown} tooltip={markTooltip} />}
		</AppContextMenu>
	);
});

/** Ancestors of the rows at the top of the list, pinned there while their children scroll under them */
export function StickyRow({
	row,
	top,
	zIndex,
	highlights,
	bound,
	checked,
	containsBound,
	activeGuide,
	onClick,
}: {
	row: EntryTreeRow;
	top: number;
	zIndex: number;
	highlights: readonly number[] | undefined;
	bound: boolean;
	checked: boolean;
	containsBound: boolean;
	activeGuide: number | undefined;
	onClick: () => void;
}) {
	const { item: node, level } = row;
	const { entry } = node;
	return (
		<div className="absolute inset-x-0 bg-sidebar" style={{ top, zIndex, height: rowHeight }}>
			<button
				type="button"
				tabIndex={-1}
				className={cn(rowClassName, 'cursor-pointer text-start')}
				style={rowStyle(0, level)}
				onClick={onClick}
			>
				<IndentGuides level={level} active={activeGuide} />
				<ChevronRightIcon className="size-4 shrink-0 rotate-90 text-muted-foreground" />
				{node.section === undefined ? (
					<>
						{entry && <TypeMark type={entry.type} tooltip={markTooltip} checked={checked} />}
						<RowLabel node={node} highlights={highlights} unsupported={entry?.kind === 'unsupported'} bound={bound} />
						{containsBound && <ContainsBoundMark />}
					</>
				) : (
					<SectionHeaderLabel section="pinned" count={node.children?.length ?? 0} />
				)}
			</button>
		</div>
	);
}

const rowClassName =
	'absolute inset-x-0 flex items-center gap-1.5 pe-3 text-sm outline-none hover:bg-accent focus-visible:bg-accent';

function rowStyle(top: number, level: number) {
	return { top, height: rowHeight, paddingInlineStart: 8 + (level - 1) * 12 };
}

/**
 * A line under each ancestor's chevron, so deep rows can be followed up to their groups. They're shown while hovering
 * the entry browser, except the `active` group's, which is always shown and stands out.
 */
function IndentGuides({ level, active }: { level: number; active: number | undefined }) {
	return (
		level > 1 && (
			<>
				<span
					aria-hidden
					className="pointer-events-none absolute inset-y-0 start-3.75 bg-[repeating-linear-gradient(to_right,var(--color-border)_0_1px,transparent_1px_12px)] opacity-0 transition-opacity duration-100 group-hover/entry-browser:opacity-100"
					style={{ width: (level - 1) * 12 - 11 }}
				/>
				{active !== undefined && (
					<span
						aria-hidden
						className="pointer-events-none absolute inset-y-0 w-px bg-outline"
						style={{ insetInlineStart: 15 + (active - 1) * 12 }}
					/>
				)}
			</>
		)
	);
}

function ContainsBoundMark() {
	return <span role="img" aria-label="Has active entries" className="size-1.5 shrink-0 rounded-full bg-primary" />;
}

/** Chevron of rows with children. Leaves show their type mark in its place. */
function RowIndicator({ expandable }: { expandable: boolean }) {
	return (
		expandable && (
			<TreeItemIndicator className="shrink-0 text-muted-foreground transition-transform data-expanded:rotate-90">
				<ChevronRightIcon className="size-4" />
			</TreeItemIndicator>
		)
	);
}

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
