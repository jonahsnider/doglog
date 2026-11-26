import type { Value } from '@/data/samples';

type Formattable = Value | bigint | Uint8Array | undefined | Formattable[] | { [key: string]: Formattable };

/** Format a value compactly for display, ex. `1.23457`, `[1, 2]`, or `x: 1, y: 2` */
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
			// Protobuf bytes fields are shown as arrays of bytes
			if (Array.isArray(value) || value instanceof Uint8Array) {
				return `[${Array.from(value, (item) => formatNested(item)).join(', ')}]`;
			}

			return Object.entries(value)
				.map(([key, field]) => `${key}: ${formatNested(field)}`)
				.join(', ');
	}
}

/** Strings inside arrays and structs are quoted so commas in them stay readable, and structs are braced so their fields stay grouped */
function formatNested(value: Formattable): string {
	if (typeof value === 'string') {
		return JSON.stringify(value);
	}

	return typeof value === 'object' && !Array.isArray(value) && !(value instanceof Uint8Array)
		? `{${formatValue(value)}}`
		: formatValue(value);
}

/** Format a value for the clipboard, JSON except plain strings which aren't quoted */
export function formatValueForCopy(value: Formattable): string {
	if (typeof value === 'string') {
		return value;
	}

	// JSON has no bigints, int64 fields beyond 2^53 lose precision. Protobuf bytes fields are arrays of bytes.
	return (
		JSON.stringify(value, (_key, field: unknown) => {
			if (typeof field === 'bigint') {
				return Number(field);
			}
			return field instanceof Uint8Array ? Array.from(field) : field;
		}) ?? ''
	);
}
