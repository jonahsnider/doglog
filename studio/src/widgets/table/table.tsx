import { IconButton } from '@astryxdesign/core/IconButton';
import { Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from '@astryxdesign/core/Table';
import {
	colorVars,
	durationVars,
	easeVars,
	sizeVars,
	spacingVars,
	textSizeVars,
	typographyVars,
} from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import ChevronRightIcon from 'lucide-react/icons/chevron-right';
import { useState } from 'react';
import { EntryTypeIcon } from '@/entries/value-marks';
import { useDataVersion } from '@/data/data-store';
import { formatValue } from '@/data/format-value';
import { formatEntryType } from '@/data/samples';
import { useCursorTime } from '@/timeline/timeline';
import { NoData } from '@/widgets/no-data';
import type { WidgetProps } from '@/widgets/widget-type';
import { EntryName } from '@/entries/entry-name';
import { useBindingDrag } from '@/entries/drag';

type FieldValue = Parameters<typeof formatValue>[0];

const styles = stylex.create({
	// Fit to content and give the rest to values, otherwise columns resize as values change
	fit: {
		width: '1px',
	},
	code: {
		fontFamily: typographyVars['--font-family-code'],
		fontSize: textSizeVars['--font-size-sm'],
	},
	value: {
		userSelect: 'text',
	},
	expandable: {
		cursor: 'pointer',
	},
	name: {
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-1'],
		whiteSpace: 'nowrap',
	},
	indent: (depth: number) => ({
		paddingInlineStart: `${depth * 1.25}rem`,
	}),
	// Doesn't make rows taller than their text
	expandButton: {
		flexShrink: 0,
		margin: `calc(-1 * ${spacingVars['--spacing-1']})`,
	},
	expandSpace: {
		flexShrink: 0,
		width: sizeVars['--size-element-sm'],
		height: sizeVars['--size-element-sm'],
		margin: `calc(-1 * ${spacingVars['--spacing-1']})`,
	},
	chevron: {
		transitionProperty: 'rotate',
		transitionDuration: durationVars['--duration-fast'],
		transitionTimingFunction: easeVars['--ease-standard'],
	},
	chevronExpanded: {
		rotate: '90deg',
	},
	grab: {
		cursor: 'grab',
	},
	type: {
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-1-5'],
		color: colorVars['--color-text-secondary'],
		whiteSpace: 'nowrap',
	},
	typeIcon: {
		flexShrink: 0,
		width: '0.875rem',
		height: '0.875rem',
	},
});

type Row = {
	binding: { id: string; name: string };
	/** Identifies the row for expansion, the binding's ID followed by the field, ex. `<id>.translation` */
	path: string;
	label: string;
	type: string | undefined;
	value: FieldValue;
	depth: number;
	missing: boolean;
};

function childrenOf(value: FieldValue): [label: string, value: FieldValue][] | undefined {
	if (Array.isArray(value)) {
		return value.length === 0 ? undefined : value.map((element, index) => [`[${index}]`, element]);
	}
	if (typeof value === 'object') {
		return Object.entries(value);
	}
	return undefined;
}

function TypeLabel({ type }: { type: string }) {
	return (
		<span {...stylex.props(styles.type, styles.code)}>
			<EntryTypeIcon type={type} {...stylex.props(styles.typeIcon)} />
			{formatEntryType(type)}
		</span>
	);
}

function valueCell(row: Row, isExpanded: boolean) {
	if (row.missing) {
		return <NoData />;
	}
	if (isExpanded) {
		return undefined;
	}
	return formatValue(row.value);
}

export function TableWidget({ bindings }: WidgetProps) {
	const time = useCursorTime();
	// Values at the cursor can change as samples arrive, ex. while a log loads
	useDataVersion();
	const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

	const toggle = (path: string) =>
		setExpanded((previous) => {
			const next = new Set(previous);
			if (!next.delete(path)) {
				next.add(path);
			}
			return next;
		});

	const rows: Row[] = [];
	const addRows = (row: Row) => {
		rows.push(row);
		if (expanded.has(row.path)) {
			for (const [label, value] of childrenOf(row.value) ?? []) {
				const path = label.startsWith('[') ? row.path + label : `${row.path}.${label}`;
				addRows({
					binding: row.binding,
					path,
					label,
					type: undefined,
					value,
					depth: row.depth + 1,
					missing: false,
				});
			}
		}
	};
	for (const { id, name, entry } of bindings) {
		addRows({
			binding: { id, name },
			path: id,
			label: name,
			type: entry?.type,
			value: entry && time !== undefined ? entry.samples.valueAt(time) : undefined,
			depth: 0,
			missing: entry === undefined,
		});
	}

	// Rows only reserve space for the expand button when some row has one, so names stay aligned
	const anyExpandable = rows.some((row) => childrenOf(row.value) !== undefined);

	return (
		<Table density="compact" hasHover>
			<TableHeader>
				<TableRow isHeaderRow>
					<TableHeaderCell xstyle={styles.fit}>Name</TableHeaderCell>
					<TableHeaderCell xstyle={styles.fit}>Type</TableHeaderCell>
					<TableHeaderCell>Value</TableHeaderCell>
				</TableRow>
			</TableHeader>
			<TableBody>
				{rows.map((row) => (
					<ValueRow
						key={row.path}
						row={row}
						expanded={expanded.has(row.path)}
						anyExpandable={anyExpandable}
						onToggle={() => toggle(row.path)}
					/>
				))}
			</TableBody>
		</Table>
	);
}

function ValueRow({
	row,
	expanded,
	anyExpandable,
	onToggle,
}: {
	row: Row;
	expanded: boolean;
	anyExpandable: boolean;
	onToggle: () => void;
}) {
	// Rows of an entry's fields and elements are part of its row, only the entry's own row can be dragged or dropped on
	const { ref, handleRef } = useBindingDrag(row.binding, { disabled: row.depth > 0 });
	const expandable = childrenOf(row.value) !== undefined;
	const isExpanded = expandable && expanded;
	return (
		<TableRow
			ref={row.depth === 0 ? ref : undefined}
			// Right-clicking the row offers to remove its binding, middle-clicking removes it
			data-binding-id={row.binding.id}
			xstyle={[expandable && styles.expandable]}
			onClick={
				expandable
					? () => {
							// Selecting text in the row shouldn't toggle it
							if (window.getSelection()?.isCollapsed === false) {
								return;
							}
							onToggle();
						}
					: undefined
			}
		>
			<TableCell xstyle={styles.code}>
				<div {...stylex.props(styles.name, styles.indent(row.depth))}>
					{expandable ? (
						<IconButton
							label={`${isExpanded ? 'Collapse' : 'Expand'} ${row.label}`}
							icon={<ChevronRightIcon {...stylex.props(styles.chevron, isExpanded && styles.chevronExpanded)} />}
							variant="ghost"
							size="sm"
							aria-expanded={isExpanded}
							xstyle={styles.expandButton}
							onClick={(event) => {
								event.stopPropagation();
								onToggle();
							}}
						/>
					) : (
						// Takes the same space as the expand button
						anyExpandable && <span {...stylex.props(styles.expandSpace)} />
					)}
					{/* Only the name starts a drag, not the expand button or selectable value. */}
					{row.depth === 0 ? (
						<span ref={handleRef} {...stylex.props(styles.grab)}>
							<EntryName name={row.label} />
						</span>
					) : (
						row.label
					)}
				</div>
			</TableCell>
			<TableCell>{row.type !== undefined && <TypeLabel type={row.type} />}</TableCell>
			<TableCell xstyle={[styles.code, styles.value]}>{valueCell(row, isExpanded)}</TableCell>
		</TableRow>
	);
}
