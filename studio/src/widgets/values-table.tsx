import { ChevronRightIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EntryTypeIcon } from '@/components/value-marks';
import { useDataVersion } from '@/data/data-store';
import { formatValue } from '@/data/format-value';
import { formatEntryType } from '@/data/samples';
import { cn } from '@/lib/utils';
import { useCursorTime } from '@/timeline';
import { NoData } from '@/widgets/no-data';
import type { WidgetProps } from '@/widgets/widget-type';
import { EntryName } from '@/components/entry-name';

type FieldValue = Parameters<typeof formatValue>[0];

type Row = {
	/** The bound entry the row belongs to, ex. `/Robot/Pose` */
	entryName: string;
	/** Identifies the row for expansion, ex. `/Robot/Pose.translation` */
	path: string;
	label: string;
	type: string | undefined;
	value: FieldValue;
	depth: number;
	missing: boolean;
};

/** Fields of a struct or elements of an array, `undefined` for values that can't be expanded */
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

export function ValuesTable({ bindings }: WidgetProps) {
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
					entryName: row.entryName,
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
	for (const { name, entry } of bindings) {
		addRows({
			entryName: name,
			path: name,
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
				{rows.map((row) => {
					const expandable = childrenOf(row.value) !== undefined;
					const isExpanded = expandable && expanded.has(row.path);
					return (
						<TableRow
							key={row.path}
							// Right-clicking the row offers to remove its entry, middle-clicking removes it
							data-entry-name={row.entryName}
							className={cn(expandable && 'cursor-pointer')}
							onClick={
								expandable
									? () => {
											// Selecting text in the row shouldn't toggle it
											if (window.getSelection()?.isCollapsed === false) {
												return;
											}
											toggle(row.path);
										}
									: undefined
							}
						>
							<TableCell className="font-mono text-xs">
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
									{row.depth === 0 ? (
										// The prefix animating open on hover briefly leaves the browser's automatic cursor on a non-text box
										<span className={cn(!expandable && 'cursor-text')}>
											<EntryName name={row.label} />
										</span>
									) : (
										row.label
									)}
								</div>
							</TableCell>
							<TableCell>{row.type !== undefined && <TypeLabel type={row.type} />}</TableCell>
							<TableCell className="font-mono text-xs whitespace-normal">{valueCell(row, isExpanded)}</TableCell>
						</TableRow>
					);
				})}
			</TableBody>
		</Table>
	);
}
