import type { Value } from '@/data/samples';

type Formattable = Value | bigint | undefined | Formattable[] | { [key: string]: Formattable };

/** Format a value compactly for display, ex. `1.23457`, `[1, 2]`, or `{x: 1, y: 2}` */
export function formatValue(value: Formattable): string {
	switch (typeof value) {
		case 'number':
			return Number.isInteger(value) ? String(value) : String(Number(value.toPrecision(6)));
		case 'string':
			return value;
		case 'boolean':
		case 'bigint':
			return String(value);
		case 'undefined':
			return '';
		default:
			if (Array.isArray(value)) {
				return `[${value.map((item) => formatNested(item)).join(', ')}]`;
			}

			return `{${Object.entries(value)
				.map(([key, field]) => `${key}: ${formatNested(field)}`)
				.join(', ')}}`;
	}
}

/** Strings inside arrays and structs are quoted so commas in them stay readable */
function formatNested(value: Formattable): string {
	return typeof value === 'string' ? JSON.stringify(value) : formatValue(value);
}
