import { IconButton } from '@astryxdesign/core/IconButton';
import { colorVars, durationVars, easeVars, spacingVars, typographyVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import ChevronRightIcon from 'lucide-react/icons/chevron-right';
import { formatEntryType } from '@/data/samples';
import { useBindingDrag } from '@/entries/drag';
import { EntryName } from '@/entries/entry-name';
import { EntryTypeIcon } from '@/entries/value-marks';
import { NoData } from '@/widgets/no-data';
import type { Column } from '@/widgets/table/columns';

const styles = stylex.create({
	headerCell: {
		display: 'flex',
		minWidth: 0,
		flexDirection: 'column',
		// Headers spanning several header rows line up with the fields' headers at the bottom
		justifyContent: 'flex-end',
		gap: spacingVars['--spacing-0-5'],
		paddingInline: spacingVars['--spacing-2'],
		paddingBlock: spacingVars['--spacing-1'],
		borderInlineStartWidth: 1,
		borderInlineStartStyle: 'solid',
		borderInlineStartColor: colorVars['--color-border'],
	},
	// Expanded columns are split into their fields' columns below them
	parentCell: {
		borderBottomWidth: 1,
		borderBottomStyle: 'solid',
		borderBottomColor: colorVars['--color-border'],
	},
	placement: (column: string, row: string) => ({ gridColumn: column, gridRow: row }),
	name: {
		display: 'flex',
		minWidth: 0,
		maxWidth: '100%',
		alignItems: 'center',
		gap: spacingVars['--spacing-1'],
		whiteSpace: 'nowrap',
	},
	label: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' },
	grab: { cursor: 'grab' },
	source: {
		flexShrink: 0,
		fontFamily: typographyVars['--font-family-body'],
		color: colorVars['--color-text-secondary'],
	},
	type: {
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-1-5'],
		color: colorVars['--color-text-secondary'],
		whiteSpace: 'nowrap',
	},
	typeIcon: { flexShrink: 0, width: '0.875rem', height: '0.875rem' },
	// Doesn't make headers taller than their text
	expandButton: { flexShrink: 0, margin: `calc(-1 * ${spacingVars['--spacing-1']})` },
	chevron: {
		transitionProperty: 'rotate',
		transitionDuration: `calc(${durationVars['--duration-fast']} * var(--motion-scale))`,
		transitionTimingFunction: easeVars['--ease-standard'],
	},
	chevronExpanded: { rotate: '90deg' },
});

// Headers line up with their column's values
const alignStyles = stylex.create({
	start: {},
	end: { alignItems: 'flex-end' },
});

/** A column's header, which spans the columns of its fields while it's expanded */
export function ColumnHeader({
	column,
	headerRows,
	expanded,
	onToggle,
}: {
	column: Column;
	headerRows: number;
	expanded: boolean;
	onToggle: () => void;
}) {
	// Fields' columns are part of their entry's column, only the entry's own column can be dragged or dropped on
	const own = column.depth === 0 && !column.extra;
	const { ref, handleRef } = useBindingDrag(column.binding, { orientation: 'horizontal', disabled: !own });
	const isParent = column.children.length > 0;
	return (
		<div
			ref={own ? ref : undefined}
			// Right-clicking the column offers to remove its binding, middle-clicking removes it
			data-binding-id={column.binding.id}
			{...stylex.props(
				styles.headerCell,
				isParent && styles.parentCell,
				!isParent && alignStyles[column.align],
				styles.placement(
					`${column.start + 2} / span ${column.span}`,
					isParent ? String(column.depth + 1) : `${column.depth + 1} / ${headerRows + 1}`,
				),
			)}
		>
			<div {...stylex.props(styles.name)}>
				{column.expandable && (
					<IconButton
						label={`${expanded ? 'Collapse' : 'Expand'} ${column.label}`}
						icon={<ChevronRightIcon {...stylex.props(styles.chevron, expanded && styles.chevronExpanded)} />}
						variant="ghost"
						size="sm"
						aria-expanded={expanded}
						xstyle={styles.expandButton}
						onClick={onToggle}
					/>
				)}
				{column.depth === 0 ? (
					// Only the name starts a drag, not the expand button
					<span ref={own ? handleRef : undefined} {...stylex.props(styles.label, own && styles.grab)}>
						<EntryName name={column.label} />
					</span>
				) : (
					<span {...stylex.props(styles.label)}>{column.label}</span>
				)}
				{column.source !== undefined && <span {...stylex.props(styles.source)}>{column.source}</span>}
			</div>
			{column.depth === 0 && (
				<div {...stylex.props(styles.type)}>
					{column.type === undefined ? (
						<NoData />
					) : (
						<>
							<EntryTypeIcon type={column.type} {...stylex.props(styles.typeIcon)} />
							{formatEntryType(column.type)}
						</>
					)}
				</div>
			)}
		</div>
	);
}
