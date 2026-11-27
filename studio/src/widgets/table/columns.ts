import type { formatValue } from '@/data/format-value';
import type { Samples } from '@/data/samples';
import type { WidgetBinding } from '@/widgets/widget-type';

type FieldValue = Parameters<typeof formatValue>[0];

export type Column = {
	binding: { id: string; name: string };
	/** Identifies the column for expansion, the binding's ID followed by its fields, ex. `<id>.translation` */
	path: string;
	/** The entry's name, or the field's name or index */
	label: string;
	type: string | undefined;
	/** `undefined` when no visible source has the entry */
	samples: Samples | undefined;
	/** Where the column's value is in the entry's values, ex. `['translation', 'x']` */
	fields: readonly (string | number)[];
	depth: number;
	/** Short name of the source the column's values are from, while several sources are visible */
	source: string | undefined;
	/** The same entry from another source, after the binding's own column, which is the one dragged */
	extra: boolean;
	expandable: boolean;
	/** Like a spreadsheet, numbers line up at the end */
	align: 'start' | 'end';
	/** Columns of its fields or elements while it's expanded */
	children: Column[];
	/** Position of its first value column, and how many value columns it spans */
	start: number;
	span: number;
};

/** The fields or elements of a struct or array value, `undefined` for values that can't be expanded */
function childrenOf(value: FieldValue): [key: string | number, value: FieldValue][] | undefined {
	if (Array.isArray(value)) {
		return value.length === 0 ? undefined : value.map((element, index) => [index, element]);
	}
	if (typeof value === 'object' && !(value instanceof Uint8Array)) {
		return Object.entries(value);
	}
	return undefined;
}

/** The field of `value` at `fields`, ex. `['translation', 'x']`, or `undefined` if it doesn't have it */
export function fieldAt(value: FieldValue, fields: readonly (string | number)[]): FieldValue {
	let field = value;
	for (const key of fields) {
		if (Array.isArray(field)) {
			field = field[Number(key)];
		} else if (typeof field === 'object' && !(field instanceof Uint8Array)) {
			field = field[key];
		} else {
			return undefined;
		}
	}
	return field;
}

/** The value a column shows at the cursor, or its first value before it, which decides the columns it expands to */
function expansionValue(samples: Samples | undefined, fields: Column['fields'], time: number | undefined) {
	if (!samples || samples.length === 0) {
		return undefined;
	}
	const index = time === undefined ? samples.length - 1 : Math.max(samples.indexAtOrBefore(time), 0);
	return fieldAt(samples.value(index), fields);
}

function alignOf(value: FieldValue): Column['align'] {
	switch (typeof value) {
		case 'number':
		case 'bigint':
			return 'end';
		default:
			return 'start';
	}
}

/**
 * The table's columns for `bindings`, with the columns whose path is in `expanded` split into their fields' columns.
 * `columns` has every column, including expanded ones, and `leaves` has the columns that show values, in order.
 */
export function tableColumns(
	bindings: readonly WidgetBinding[],
	expanded: ReadonlySet<string>,
	time: number | undefined,
): { columns: Column[]; leaves: Column[] } {
	const columns: Column[] = [];
	const leaves: Column[] = [];
	const addColumn = (column: Omit<Column, 'expandable' | 'align' | 'children' | 'start' | 'span'>) => {
		const value = expansionValue(column.samples, column.fields, time);
		const children = childrenOf(value);
		const added: Column = {
			...column,
			expandable: children !== undefined,
			align: alignOf(value),
			children: [],
			start: leaves.length,
			span: 1,
		};
		columns.push(added);
		if (children && expanded.has(column.path)) {
			for (const [key] of children) {
				added.children.push(
					addColumn({
						...column,
						path: typeof key === 'number' ? `${column.path}[${key}]` : `${column.path}.${key}`,
						label: typeof key === 'number' ? `[${key}]` : key,
						type: undefined,
						fields: [...column.fields, key],
						depth: column.depth + 1,
					}),
				);
			}
			added.span = leaves.length - added.start;
		} else {
			leaves.push(added);
		}
		return added;
	};

	for (const { id, name, entry, source, others } of bindings) {
		const sources = entry ? [{ entry, source }, ...others] : [{ entry: undefined, source: undefined }];
		for (const [index, from] of sources.entries()) {
			addColumn({
				binding: { id, name },
				path: index === 0 ? id : `${id}:${from.source?.id}`,
				label: name,
				type: from.entry?.type,
				samples: from.entry?.samples,
				fields: [],
				depth: 0,
				source: from.source?.labeled === true ? from.source.label : undefined,
				extra: index > 0,
			});
		}
	}
	return { columns, leaves };
}
