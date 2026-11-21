import type { StructDeclaration, StructPayload } from 'wpilib-struct';
import type { Entry } from '@/data/data-store';
import type { EntryKind } from '@/data/entry-kind';
import { getEntryKind, Samples, type Value } from '@/data/samples';

/** Index of an array element or name of a struct field */
export type FieldKey = number | string;

type Field = Value | StructPayload[string];

function isBigIntArray(field: Field): field is bigint[] {
	return Array.isArray(field) && typeof field[0] === 'bigint';
}

/** The value of the field at `path` in a logged value, `undefined` when it doesn't have one, ex. past the end of an array */
function fieldValue(value: Value | undefined, path: readonly FieldKey[]): Value | undefined {
	let field: Field = value;
	for (const key of path) {
		if (typeof key === 'number') {
			field = Array.isArray(field) ? field[key] : undefined;
		} else {
			field = typeof field === 'object' && !Array.isArray(field) ? field[key] : undefined;
		}
	}
	// Struct int64 fields are bigints
	if (typeof field === 'bigint') {
		return Number(field);
	}
	if (isBigIntArray(field)) {
		return field.map(Number);
	}
	return field;
}

const noMetadata: Readonly<Record<string, unknown>> = {};

/** The type of a struct field as an entry type, ex. `double` or `struct:Translation2d` */
export function structFieldType({ value, arraySize }: StructDeclaration): string {
	if (value === 'char') {
		return 'string';
	}
	let type: string;
	switch (value) {
		case 'bool':
			type = 'boolean';
			break;
		case 'float':
		case 'float32':
			type = 'float';
			break;
		case 'double':
		case 'float64':
			type = 'double';
			break;
		case 'int8':
		case 'int16':
		case 'int32':
		case 'int64':
		case 'uint8':
		case 'uint16':
		case 'uint32':
		case 'uint64':
			type = 'int64';
			break;
		default:
			type = `struct:${value}`;
	}
	return arraySize === undefined ? type : `${type}[]`;
}

/**
 * An array element or struct field of a logged entry, shown as if it was logged on its own, ex. `/Drive/ModuleStates/0/speed`.
 * Its samples are copied from the logged entry's the first time they're used, and kept up to date as they're read, so
 * fields nobody looks at take no memory.
 */
export class FieldEntry implements Entry {
	readonly name: string;
	readonly type: string;
	readonly kind: EntryKind;
	/** The logged entry this is a field of */
	readonly root: Entry;
	/** Where the field is in the logged entry's values */
	readonly path: readonly FieldKey[];
	private copy: Samples | undefined;
	// How many of the logged entry's samples have been read, and its `rewrites` then
	private read = 0;
	private rewrites = 0;

	constructor(parent: Entry, key: FieldKey, type: string) {
		this.name = `${parent.name}/${key}`;
		this.type = type;
		this.kind = getEntryKind(type);
		const isField = parent instanceof FieldEntry;
		this.root = isField ? parent.root : parent;
		this.path = isField ? [...parent.path, key] : [key];
	}

	/** An array's metadata, like its unit, applies to its elements. Struct fields have none. */
	get metadata(): Readonly<Record<string, unknown>> {
		return this.path.every((key) => typeof key === 'number') ? this.root.metadata : noMetadata;
	}

	get samples(): Samples {
		this.copy ??= new Samples();
		this.sync(this.copy);
		return this.copy;
	}

	private sync(copy: Samples): void {
		const source = this.root.samples;
		if (source.rewrites !== this.rewrites) {
			// Samples were trimmed or inserted out of order, start over
			this.rewrites = source.rewrites;
			this.read = 0;
			copy.timestamps = new Float64Array(16);
			copy.values = [];
			copy.rewrites++;
		}
		for (let index = this.read; index < source.length; index++) {
			const value = fieldValue(source.values[index], this.path);
			if (value !== undefined) {
				copy.push(source.timestamps[index]!, value);
			}
		}
		this.read = source.length;
	}
}
