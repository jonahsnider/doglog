import { colorVars, radiusVars, spacingVars, typeScaleVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { useDraggable, useDroppable } from '@dnd-kit/react';
import { TreeItem, TreeItemLabel } from '@ui-sdk/react/tree';
import ChevronRightIcon from 'lucide-react/icons/chevron-right';
import { memo, use, useCallback, useRef } from 'react';
import { AppActionMenu, AppContextMenu, type MenuEntry } from '@/components/app-context-menu';
import { openContextMenu } from '@/components/open-context-menu';
import { SectionHeaderLabel } from '@/entries/section-header-label';
import { type GroupCheck, GroupCheckbox, GroupMark, TypeMark } from '@/entries/value-marks';
import { EntryRowValue } from '@/entries/entry-value';
import { entryMenuItems } from '@/entries/entry-menu';
import { addDashboardWidget, DashboardIdContext } from '@/dashboards/panes';
import type { EntryDragData, EntryDragItem, EntrySectionDropData } from '@/entries/drag';
import { entryDragType, entryRowDragType, entryRowSensors } from '@/entries/drag';
import { sectionMenuItems } from '@/entries/sections';
import type { EntryTreeRow } from '@/entries/tree';
import { ContainsBoundMark, IndentGuides, RowIndicator, RowLabel } from '@/entries/entry-row-parts';
import { entryRowMarker } from './markers.stylex';
import { defaultWidget } from '@/widgets/registry';

/** Rows have a fixed height so only the rows in view need to be rendered */
export const rowHeight = 28;

const styles = stylex.create({
	// Inset and rounded like the sidebar's items, with the leading icons lined up with the search box's
	row: {
		position: 'absolute',
		insetInline: spacingVars['--spacing-2'],
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-1-5'],
		borderRadius: radiusVars['--radius-element'],
		paddingInlineEnd: '0.625rem',
		fontSize: typeScaleVars['--text-label-size'],
		lineHeight: typeScaleVars['--text-label-leading'],
		outline: 'none',
		backgroundColor: {
			default: null,
			':hover': colorVars['--color-overlay-hover'],
			':focus-visible': colorVars['--color-overlay-hover'],
		},
	},
	// Square while dropping on its section, so the section's rows highlight as one block
	dropTarget: {
		borderRadius: 0,
		backgroundColor: {
			default: `color-mix(in srgb, ${colorVars['--color-accent']} 8%, transparent)`,
			':hover': colorVars['--color-overlay-hover'],
			':focus-visible': colorVars['--color-overlay-hover'],
		},
	},
	entry: {
		cursor: { default: 'grab', ':active': 'grabbing' },
	},
	sticky: {
		cursor: 'pointer',
		textAlign: 'start',
	},
	stickySlot: {
		position: 'absolute',
		insetInline: 0,
		overflow: 'hidden',
	},
	label: {
		display: 'flex',
		flex: 1,
		alignItems: 'center',
		gap: spacingVars['--spacing-1-5'],
		height: '100%',
		minWidth: 0,
	},
	// Share cramped rows with the preview without letting it take all the space
	entryLabel: {
		minWidth: 'min(7.5rem, 65%)',
		overflow: 'hidden',
	},
	actions: {
		flexShrink: 0,
		marginInlineEnd: '-0.375rem',
		opacity: {
			default: 0,
			'@media (hover: none)': 1,
			':is([aria-expanded=true])': 1,
			[stylex.when.ancestor(':hover', entryRowMarker)]: 1,
			[stylex.when.ancestor(':focus-within', entryRowMarker)]: 1,
		},
	},
	chevron: {
		flexShrink: 0,
		width: 16,
		height: 16,
	},
	expandedChevron: {
		color: colorVars['--color-icon-secondary'],
		transform: 'rotate(90deg)',
	},
});

// Memoized so rows don't re-render when the cursor moves, only their values do
export const EntryRowView = memo(function EntryRowView({
	row,
	top,
	highlights,
	dropTarget,
	editing,
	bound,
	containsBound,
	groupCheck,
	group,
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
	/** Set on groups that aren't entries themselves while editing, see `GroupCheckbox` */
	groupCheck: GroupCheck | undefined;
	group: readonly EntryDragItem[] | undefined;
	/** Level of the group whose guide is emphasized, when the row is in it */
	activeGuide: number | undefined;
}) {
	const dashboardId = use(DashboardIdContext);
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
		type: unsupported ? entryRowDragType : entryDragType,
		disabled: header,
		sensors: entryRowSensors,
		data: { name: node.value, field: field?.name, group, section },
	});
	const { ref: dropRef } = useDroppable<EntrySectionDropData>({
		id: node.value,
		accept: (source) => source.data['section'] !== undefined,
		// The Active section lists entries again, they can't be moved to it
		disabled: section === 'active',
		data: { section },
	});
	const rowElement = useRef<HTMLElement>(null);
	const ref = useCallback(
		(element: Element | null) => {
			dragRef(element);
			dropRef(element);
			rowElement.current = element instanceof HTMLElement ? element : null;
		},
		[dragRef, dropRef],
	);
	const style = rowStyle(top, level);

	if (header) {
		return (
			// Without the drag ref, headers don't get dnd-kit's drag handle attributes
			<TreeItem
				value={node.value}
				data-value={node.value}
				ref={dropRef}
				{...stylex.props(styles.row, dropTarget && styles.dropTarget)}
				style={style}
			>
				<TreeItemLabel {...stylex.props(styles.label)}>
					<RowIndicator expandable={node.children !== undefined} />
					<SectionHeaderLabel section="pinned" count={node.children?.length ?? 0} />
				</TreeItemLabel>
			</TreeItem>
		);
	}

	const menuItems = (): MenuEntry[] => [
		...entryMenuItems(dashboardId, entry, field, add),
		...sectionMenuItems(node.value, section),
	];

	return (
		<AppContextMenu items={menuItems} label="Entry actions">
			<TreeItem
				value={node.value}
				// Tells the tree which row has focus, see `EntryRows`
				data-value={node.value}
				ref={ref}
				{...stylex.props(entryRowMarker, styles.row, dropTarget && styles.dropTarget, styles.entry)}
				style={style}
				aria-keyshortcuts="Shift+F10"
				onKeyDown={(event) => {
					if (
						event.target === event.currentTarget &&
						(event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))
					) {
						event.preventDefault();
						openContextMenu(event.currentTarget);
					}
				}}
				onDoubleClick={editing ? undefined : add}
			>
				<IndentGuides level={level} active={activeGuide} />
				<TreeItemLabel {...stylex.props(styles.label, styles.entryLabel)}>
					<RowIndicator expandable={node.children !== undefined} />
					{/* Checked while editing instead of having a checkbox of its own, so editing doesn't push the label over */}
					{entry && <TypeMark type={entry.type} checked={editing && bound} checkable={editing} />}
					<GroupCheckbox check={groupCheck} />
					<RowLabel node={node} highlights={highlights} unsupported={unsupported} bound={bound} />
					{containsBound && <ContainsBoundMark />}
				</TreeItemLabel>
				{node.children && <GroupMark path={node.value} />}
				{entry && <EntryRowValue entry={entry} field={field} />}
				<AppActionMenu
					items={menuItems}
					label="Entry actions"
					accessibleLabel={`Actions for ${node.value}`}
					shortcut="Shift+F10"
					// The tree stays one tab stop; Shift+F10 opens the menu from the focused row.
					isFocusable={false}
					finalFocus={rowElement}
					triggerXstyle={styles.actions}
				/>
			</TreeItem>
		</AppContextMenu>
	);
});

/**
 * Ancestors of the rows at the top of the list, pinned there while their children scroll under them. They have no
 * background, shadow, or fade, since the frame behind them can be translucent; the rows under them are hidden instead.
 */
export function StickyRow({
	row,
	slot,
	top,
	highlights,
	bound,
	checked,
	containsBound,
	groupCheck,
	activeGuide,
	onClick,
}: {
	row: EntryTreeRow;
	/** Where the row is pinned when it isn't being pushed out */
	slot: number;
	top: number;
	highlights: readonly number[] | undefined;
	bound: boolean;
	checked: boolean;
	containsBound: boolean;
	groupCheck: GroupCheck | undefined;
	activeGuide: number | undefined;
	onClick: () => void;
}) {
	const { item: node, level } = row;
	const { entry } = node;
	return (
		// Clipped to its slot, so a row being pushed out slides under the one above it without a background to hide it
		<div {...stylex.props(styles.stickySlot)} style={{ top: slot, height: rowHeight }}>
			<button
				type="button"
				tabIndex={-1}
				{...stylex.props(styles.row, styles.sticky)}
				style={rowStyle(top - slot, level)}
				onClick={onClick}
			>
				<IndentGuides level={level} active={activeGuide} />
				<ChevronRightIcon {...stylex.props(styles.chevron, styles.expandedChevron)} />
				{node.section === undefined ? (
					<>
						{entry && <TypeMark type={entry.type} checked={checked} />}
						<GroupCheckbox check={groupCheck} sticky />
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

function rowStyle(top: number, level: number) {
	return { top, height: rowHeight, paddingInlineStart: 10 + (level - 1) * 12 };
}
