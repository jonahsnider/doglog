import { ChevronRightIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EntryTypeIcon } from '@/entries/value-marks';
import { useDataVersion } from '@/data/data-store';
import { formatValue } from '@/data/format-value';
import { formatEntryType } from '@/data/samples';
import { cn } from '@/lib/utils';
import { useCursorTime } from '@/timeline/timeline';
import { NoData } from '@/widgets/no-data';
import type { WidgetProps } from '@/widgets/widget-type';
import { EntryName } from '@/entries/entry-name';
import { useBindingDrag } from '@/entries/drag';

type FieldValue = Parameters<typeof formatValue>[0];

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
		<span className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
			<EntryTypeIcon type={type} className="size-3.5 shrink-0" />
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
		<Table>
			<TableHeader>
				<TableRow>
					{/* Fit to content and give the rest to values, otherwise columns resize as values change */}
					<TableHead className="w-px">Name</TableHead>
					<TableHead className="w-px">Type</TableHead>
					<TableHead>Value</TableHead>
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
			ref={ref}
			// Right-clicking the row offers to remove its binding, middle-clicking removes it
			data-binding-id={row.binding.id}
			className={cn(expandable && 'cursor-pointer')}
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
			{/* Dragged by the name, so values stay selectable */}
			<TableCell
				ref={row.depth === 0 ? handleRef : undefined}
				className={cn('font-mono text-xs', row.depth === 0 && 'cursor-grab')}
			>
				<div className="flex items-center gap-1" style={{ paddingLeft: `${row.depth * 1.25}rem` }}>
					{expandable ? (
						<Button
							variant="ghost"
							size="icon-xs"
							className="-m-1 text-muted-foreground"
							aria-expanded={isExpanded}
							aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${row.label}`}
						>
							<ChevronRightIcon className={cn('size-3.5 transition-transform', isExpanded && 'rotate-90')} />
						</Button>
					) : (
						anyExpandable && (
							// Takes the same space as the expand button
							<span className="-m-1 size-7 shrink-0 sm:size-6" />
						)
					)}
					{row.depth === 0 ? <EntryName name={row.label} /> : row.label}
				</div>
			</TableCell>
			<TableCell>{row.type !== undefined && <TypeLabel type={row.type} />}</TableCell>
			<TableCell className="font-mono text-xs whitespace-normal select-text">{valueCell(row, isExpanded)}</TableCell>
		</TableRow>
	);
}
