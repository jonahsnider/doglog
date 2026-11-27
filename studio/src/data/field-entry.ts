import type { ProtobufValue } from 'wpilog-parser';
import type { StructDeclaration, StructPayload } from 'wpilib-struct';
import type { Entry } from '@/data/data-store';
import type { EntryKind } from '@/data/entry-kind';
import {
	createSamples,
	getEntryKind,
	NumberArraySamples,
	protobufMessageField,
	type Samples,
	type Value,
} from '@/data/samples';

/** Index of an array element or name of a struct field */
export type FieldKey = number | string;

type Field = Value | StructPayload[string] | ProtobufValue;

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
			field =
				typeof field === 'object' && !Array.isArray(field) && !(field instanceof Uint8Array) ? field[key] : undefined;
		}
	}
	// Struct int64 fields are bigints
	if (typeof field === 'bigint') {
		return Number(field);
	}
	if (isBigIntArray(field)) {
		return field.map(Number);
	}
	// Protobuf bytes aren't supported
	return field instanceof Uint8Array ? undefined : field;
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
 * The type of a decoded protobuf field as an entry type, from its value since Studio doesn't read protobuf schemas.
 * `undefined` for bytes, which aren't supported, and empty repeated fields, which don't say what they hold.
 */
export function protobufFieldType(value: ProtobufValue | undefined): string | undefined {
	if (Array.isArray(value)) {
		const element = protobufFieldType(value[0]);
		return element === undefined ? undefined : `${element}[]`;
	}
	switch (typeof value) {
		case 'number':
			return 'double';
		case 'bigint':
			return 'int64';
		case 'boolean':
			return 'boolean';
		case 'string':
			return 'string';
		case 'object':
			return value instanceof Uint8Array ? undefined : protobufMessageField;
		default:
			return undefined;
	}
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

	constructor(root: Entry, path: readonly FieldKey[], type: string) {
		this.name = `${root.name}/${path.join('/')}`;
		this.type = type;
		this.kind = getEntryKind(type);
		this.root = root;
		this.path = path;
	}

	/** An array's metadata, like its unit, applies to its elements. Struct fields have none. */
	get metadata(): Readonly<Record<string, unknown>> {
		return this.path.every((key) => typeof key === 'number') ? this.root.metadata : noMetadata;
	}

	get samples(): Samples {
		this.copy ??= createSamples(this.kind);
		this.sync(this.copy);
		return this.copy;
	}

	private sync(copy: Samples): void {
		const source = this.root.samples;
		if (source.rewrites !== this.rewrites) {
			// Samples were trimmed or inserted out of order, start over
			this.rewrites = source.rewrites;
			this.read = 0;
			copy.clear();
		}
		// An element of an array of numbers is read without making the array
		const [key] = this.path;
		const item = this.path.length === 1 && typeof key === 'number' ? key : undefined;
		const array = source instanceof NumberArraySamples ? source : undefined;
		for (let index = this.read; index < source.length; index++) {
			const value =
				array && item !== undefined ? array.itemAt(index, item) : fieldValue(source.value(index), this.path);
			if (value !== undefined) {
				copy.push(source.timestamps[index]!, value);
			}
		}
		this.read = source.length;
	}
}
