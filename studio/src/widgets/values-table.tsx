import { ChevronRightIcon } from 'lucide-react';
import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDataVersion } from '@/data/data-store';
import { formatValue } from '@/data/format-value';
import { cn } from '@/lib/utils';
import { useCursorTime } from '@/timeline';
import { NoData } from '@/widgets/no-data';
import type { WidgetProps } from '@/widgets/widget-type';

type FieldValue = Parameters<typeof formatValue>[0];

type Row = {
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
				addRows({ path, label, type: undefined, value, depth: row.depth + 1, missing: false });
			}
		}
	};
	for (const { name, entry } of bindings) {
		addRows({
			path: name,
			label: name,
			type: entry?.type,
			value: entry && time !== undefined ? entry.samples.valueAt(time) : undefined,
			depth: 0,
			missing: entry === undefined,
		});
	}

	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>Name</TableHead>
					<TableHead>Type</TableHead>
					<TableHead>Value</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{rows.map((row) => {
					const expandable = childrenOf(row.value) !== undefined;
					const isExpanded = expandable && expanded.has(row.path);
					return (
						<TableRow key={row.path}>
							<TableCell className="font-mono text-xs">
								<div className="flex items-center gap-1" style={{ paddingLeft: `${row.depth * 1.25}rem` }}>
									{expandable ? (
										<button
											type="button"
											className="-m-1 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
											aria-expanded={isExpanded}
											aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${row.label}`}
											onClick={() => toggle(row.path)}
										>
											<ChevronRightIcon className={cn('size-3.5 transition-transform', isExpanded && 'rotate-90')} />
										</button>
									) : (
										<span className="size-3.5 shrink-0" />
									)}
									{row.label}
								</div>
							</TableCell>
							<TableCell className="text-muted-foreground">{row.type}</TableCell>
							<TableCell className="font-mono text-xs whitespace-normal">
								{row.missing ? <NoData /> : isExpanded ? undefined : formatValue(row.value)}
							</TableCell>
						</TableRow>
					);
				})}
			</TableBody>
		</Table>
	);
}
