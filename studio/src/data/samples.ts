// oxlint-disable max-lines, max-classes-per-file -- Each kind of samples is a small class that only makes sense next to the base it extends
import { StructRegistry } from 'wpilib-struct';
import type { ProtobufPayload, ProtobufValue, StructPayload } from 'wpilog-parser';
import type { EntryKind } from '@/data/entry-kind';

/** A decoded value of a supported entry type */
export type Value =
	| number
	| boolean
	| string
	| number[]
	| boolean[]
	| string[]
	| StructPayload
	| StructPayload[]
	| ProtobufPayload
	| ProtobufValue[];

const protobufPrefix = 'proto:';

/**
 * Type of a protobuf message's fields that are messages too. Values don't say which message they are, so they share a type.
 * See `protobufFieldType()` in `@/data/field-entry`.
 */
export const protobufMessageField = 'protobuf message';

/** The message of a protobuf entry, ex. `wpi.proto.ProtobufPose2d` for `proto:wpi.proto.ProtobufPose2d`, or `undefined` if it isn't one */
export function protobufMessage(type: string): string | undefined {
	return type.startsWith(protobufPrefix) ? type.slice(protobufPrefix.length) : undefined;
}

/** Get the kind of an entry from its WPILOG or NT4 type string, ex. `double`, `int64[]`, or `struct:Pose2d` */
export function getEntryKind(type: string): EntryKind {
	switch (type) {
		case 'boolean':
			return 'boolean';
		case 'double':
		case 'float':
		case 'int':
		case 'int64':
			return 'number';
		case 'string':
		case 'json':
			return 'string';
		case 'boolean[]':
			return 'boolean[]';
		case 'double[]':
		case 'float[]':
		case 'int[]':
		case 'int64[]':
			return 'number[]';
		case 'string[]':
			return 'string[]';
	}

	// Synthesized for groups of entries logged by a WPILib `Mechanism2d`, see `@/data/mechanism`
	if (type === 'Mechanism2d') {
		return 'mechanism2d';
	}

	if (type.startsWith('struct:')) {
		return type.endsWith('[]') ? 'struct[]' : 'struct';
	}

	// Decoded protobuf messages have named fields like structs
	if (type === protobufMessageField || protobufMessage(type) !== undefined) {
		return 'struct';
	}
	if (type === `${protobufMessageField}[]`) {
		return 'struct[]';
	}

	// msgpack, raw bytes, etc.
	return 'unsupported';
}

/**
 * Type string shown to users, ex. `Pose2d` for `struct:Pose2d`, `ProtobufPose2d` for `proto:wpi.proto.ProtobufPose2d`,
 * or `.hoot log` for `log:hoot`
 */
export function formatEntryType(type: string): string {
	const format = embeddedLogFormat(type);
	if (format !== undefined) {
		return `.${format} log`;
	}
	const message = protobufMessage(type);
	if (message !== undefined) {
		return message.slice(message.lastIndexOf('.') + 1);
	}
	return type.startsWith('struct:') ? type.slice('struct:'.length) : type;
}

/**
 * The file extension of a log embedded in an entry, ex. `hoot` for `log:hoot`, or `undefined` if the entry isn't one.
 * An embedded log is a raw entry whose records, in order, are the bytes of another log file, ex. a vendor's log.
 */
export function embeddedLogFormat(type: string): string | undefined {
	return type.startsWith('log:') ? type.slice('log:'.length).toLowerCase() : undefined;
}

/** Formats of embedded logs that Studio reads, their entries are listed under the embedded log's entry */
export const readableEmbeddedLogFormats: ReadonlySet<string> = new Set(['wpilog', 'wpilogxz', 'hoot']);

/** Whether an entry holds schemas used to decode other entries (ex. `/.schema/struct:Pose2d`), these are hidden from users */
export function isSchemaEntry(name: string): boolean {
	return name.startsWith('/.schema/');
}

/** Topics Studio uses to share dashboards, see `@/sharing/nt-sync` */
export const studioTopicPrefix = '/DogLogStudio/';

/** Studio's own topics, and robot logs' copies of them, aren't data to show */
export function isStudioEntry(name: string): boolean {
	return withoutNtPrefix(name).startsWith(studioTopicPrefix);
}

/** Logs that record NetworkTables put its topics under `/NT:`, live sessions show them without it */
const ntLogPrefix = '/NT:';

/** `name` without the prefix of topics a log recorded from NetworkTables, ex. `/FMSInfo/EventName` for `/NT:/FMSInfo/EventName` */
export function withoutNtPrefix(name: string): string {
	return name.startsWith(`${ntLogPrefix}/`) ? name.slice(ntLogPrefix.length) : name;
}

/**
 * The entry named `name`, or the same NetworkTables topic under its other name when there isn't one, so
 * `/FMSInfo/EventName` finds `/NT:/FMSInfo/EventName` in a log that recorded NetworkTables and the other way around
 */
export function findEntry<T>(entries: ReadonlyMap<string, T>, name: string): T | undefined {
	const bare = withoutNtPrefix(name);
	return entries.get(name) ?? entries.get(bare === name ? `${ntLogPrefix}${name}` : bare);
}

/** Entry names always start with `/`, matching how WPILOG and NT4 names are usually written */
export function normalizeEntryName(name: string): string {
	return name.startsWith('/') ? name : `/${name}`;
}

type PackedStructs = {
	bytes: Uint8Array<ArrayBuffer>;
	offsets: Uint32Array<ArrayBuffer>;
	name: string;
	schemas: [string, string][];
	stride: number;
	array: boolean;
};

/** Samples in a form a worker or another window can be sent, see `Samples.toTransfer()` */
export type SamplesTransfer = { timestamps: Float64Array<ArrayBuffer>; length: number } & (
	| { values: Value[] }
	| { numbers: Float64Array<ArrayBuffer> }
	| { items: Float64Array<ArrayBuffer>; offsets: Uint32Array<ArrayBuffer> }
	| { structs: PackedStructs }
);

function grow<T extends Float64Array<ArrayBuffer> | Uint32Array<ArrayBuffer>>(array: T, size: number): T {
	if (size <= array.length) {
		return array;
	}
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- A typed array's constructor makes the same type of typed array
	const grown = new (array.constructor as new (length: number) => T)(Math.max(16, size, array.length * 2));
	grown.set(array);
	return grown;
}

/**
 * Time-ordered samples of one entry.
 * Timestamps are in microseconds, `timestamps[i]` is the time of `value(i)`, and only the first `length` items are used.
 * Numbers and arrays of numbers are kept in typed arrays, so a worker can send them without copying, see `createSamples()`.
 */
export abstract class Samples {
	timestamps: Float64Array<ArrayBuffer>;
	length: number;
	/** Changes when samples are removed or inserted before the latest one, so copies made from them know to start over */
	rewrites = 0;

	constructor(timestamps: Float64Array<ArrayBuffer>, length: number) {
		this.timestamps = timestamps;
		this.length = length;
	}

	/** The value of the sample at `index`, or `undefined` if there is none */
	abstract value(index: number): Value | undefined;

	/** Every value, in order */
	values(): Value[] {
		return Array.from({ length: this.length }, (_, index) => this.value(index)!);
	}

	/** How many items the value at `index` has, 0 if it isn't an array */
	lengthAt(index: number): number {
		const value = this.value(index);
		return Array.isArray(value) ? value.length : 0;
	}

	/** Store `value` as the sample at `index`, moving the samples at and after it up one */
	protected abstract insertValue(index: number, value: Value): void;

	/** Remove the first `count` values */
	protected abstract removeValues(count: number): void;

	/** A copy, without the room kept for more samples */
	abstract copy(): Samples;

	/** The samples to send without copying them, see `transferables()`. They can't be used once they're sent. */
	abstract toTransfer(): SamplesTransfer;

	/** Remove every sample */
	clear(): void {
		this.removeValues(this.length);
		this.timestamps = new Float64Array(16);
		this.length = 0;
		this.rewrites++;
	}

	/** Add a sample, keeping samples sorted by time */
	push(timestamp: number, value: Value): void {
		const { length } = this;
		this.timestamps = grow(this.timestamps, length + 1);

		if (length === 0 || timestamp >= this.timestamps[length - 1]!) {
			this.timestamps[length] = timestamp;
			this.insertValue(length, value);
			this.length++;
			return;
		}

		// Rare: a sample arrived out of order, insert it after any samples with the same timestamp
		const index = this.indexAtOrBefore(timestamp) + 1;
		this.timestamps.copyWithin(index + 1, index, length);
		this.timestamps[index] = timestamp;
		this.insertValue(index, value);
		this.length++;
		this.rewrites++;
	}

	/** Index of the latest sample at or before `time`, or -1 if there is none */
	indexAtOrBefore(time: number): number {
		let low = 0;
		let high = this.length;
		while (low < high) {
			const middle = (low + high) >>> 1;
			if (this.timestamps[middle]! <= time) {
				low = middle + 1;
			} else {
				high = middle;
			}
		}
		return low - 1;
	}

	/** Index of the earliest sample at or after `time`, or `length` if there is none */
	indexAtOrAfter(time: number): number {
		let low = 0;
		let high = this.length;
		while (low < high) {
			const middle = (low + high) >>> 1;
			if (this.timestamps[middle]! < time) {
				low = middle + 1;
			} else {
				high = middle;
			}
		}
		return low;
	}

	/** The latest value at or before `time`, or `undefined` if there is none */
	valueAt(time: number): Value | undefined {
		return this.value(this.indexAtOrBefore(time));
	}

	/**
	 * Remove samples that aren't needed for values at or after `time`. The latest sample is always kept.
	 * Returns how many samples were removed.
	 */
	trimBefore(time: number): number {
		const count = this.indexAtOrBefore(time);
		if (count <= 0) {
			return 0;
		}
		this.timestamps.copyWithin(0, count, this.length);
		this.removeValues(count);
		this.length -= count;
		this.rewrites++;
		return count;
	}

	protected has(index: number): boolean {
		return index >= 0 && index < this.length;
	}
}

/** Samples of any kind of value */
class ValueSamples extends Samples {
	protected stored: Value[];

	constructor(timestamps = new Float64Array(16), values: Value[] = []) {
		super(timestamps, values.length);
		this.stored = values;
	}

	value(index: number): Value | undefined {
		return this.stored[index];
	}

	override values(): Value[] {
		return this.stored.slice();
	}

	protected insertValue(index: number, value: Value): void {
		if (index === this.stored.length) {
			this.stored.push(value);
		} else {
			this.stored.splice(index, 0, value);
		}
	}

	protected removeValues(count: number): void {
		this.stored.splice(0, count);
	}

	copy(): Samples {
		return new ValueSamples(this.timestamps.slice(0, this.length), this.stored.slice());
	}

	toTransfer(): SamplesTransfer {
		return { timestamps: this.timestamps, length: this.length, values: this.stored };
	}
}

/** Packed WPILOG structs. Data the user never looks at stays in its original binary form. */
class StructSamples extends ValueSamples {
	private structs: PackedStructs | undefined;
	private registry: StructRegistry | undefined;
	private cached: { index: number; value: StructPayload | StructPayload[] } | undefined;

	constructor(timestamps: Float64Array<ArrayBuffer>, length: number, structs: PackedStructs) {
		super(timestamps);
		this.length = length;
		this.structs = structs;
	}

	override value(index: number): Value | undefined {
		if (!this.structs) {
			return super.value(index);
		}
		if (!this.has(index)) {
			return undefined;
		}
		if (this.cached?.index === index) {
			return this.cached.value;
		}
		const { bytes, offsets, name, schemas, array } = this.structs;
		if (!this.registry) {
			this.registry = new StructRegistry();
			for (const [type, schema] of schemas) {
				this.registry.register(type, schema);
			}
		}
		const value = array
			? this.registry.decodeArray(name, bytes.subarray(offsets[index], offsets[index + 1]))
			: this.registry.decode(name, bytes, offsets[index]);
		if (typeof value === 'string') {
			return undefined;
		}
		this.cached = { index, value };
		return value;
	}

	override values(): Value[] {
		return this.structs ? Array.from({ length: this.length }, (_, index) => this.value(index)!) : super.values();
	}

	override lengthAt(index: number): number {
		const { structs } = this;
		if (!structs) {
			return super.lengthAt(index);
		}
		return structs.array && this.has(index)
			? (structs.offsets[index + 1]! - structs.offsets[index]!) / structs.stride
			: 0;
	}

	private unpack(keepValues: boolean): void {
		if (this.structs) {
			if (keepValues) {
				this.stored = this.values();
			}
			this.structs = undefined;
			this.registry = undefined;
			this.cached = undefined;
		}
	}

	protected override insertValue(index: number, value: Value): void {
		this.unpack(true);
		super.insertValue(index, value);
	}

	protected override removeValues(count: number): void {
		this.unpack(count < this.length);
		super.removeValues(count);
	}

	override copy(): Samples {
		const { structs, timestamps, length } = this;
		return structs
			? new StructSamples(timestamps.slice(0, length), length, {
					...structs,
					bytes: structs.bytes.slice(),
					offsets: structs.offsets.slice(),
				})
			: super.copy();
	}

	override toTransfer(): SamplesTransfer {
		const { timestamps, length, structs } = this;
		return structs ? { timestamps, length, structs } : super.toTransfer();
	}
}

/** Samples of numbers, kept in a typed array */
class NumberSamples extends Samples {
	private numbers: Float64Array<ArrayBuffer>;

	constructor(timestamps = new Float64Array(16), numbers = new Float64Array(16), length = 0) {
		super(timestamps, length);
		this.numbers = numbers;
	}

	value(index: number): number | undefined {
		return this.has(index) ? this.numbers[index] : undefined;
	}

	protected insertValue(index: number, value: Value): void {
		this.numbers = grow(this.numbers, this.length + 1);
		// Almost always added at the end, from a log
		if (index < this.length) {
			this.numbers.copyWithin(index + 1, index, this.length);
		}
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Samples are made for their entry's kind, see `createSamples()`
		this.numbers[index] = value as number;
	}

	protected removeValues(count: number): void {
		this.numbers.copyWithin(0, count, this.length);
	}

	copy(): Samples {
		return new NumberSamples(this.timestamps.slice(0, this.length), this.numbers.slice(0, this.length), this.length);
	}

	toTransfer(): SamplesTransfer {
		return { timestamps: this.timestamps, length: this.length, numbers: this.numbers };
	}
}

/**
 * Samples of arrays of numbers, kept in one typed array of every array's items. Arrays are only made when a value is
 * read, see `value()`, so an entry nobody looks at never makes them.
 */
export class NumberArraySamples extends Samples {
	private items: Float64Array<ArrayBuffer>;
	/** Where each sample's items start in `items`, and where the last one's end */
	private offsets: Uint32Array<ArrayBuffer>;
	// The latest value read, so reading it again gives the same array
	private cached: { index: number; rewrites: number; value: number[] } | undefined;

	constructor(
		timestamps = new Float64Array(16),
		items = new Float64Array(16),
		offsets = new Uint32Array(17),
		length = 0,
	) {
		super(timestamps, length);
		this.items = items;
		this.offsets = offsets;
	}

	value(index: number): number[] | undefined {
		if (!this.has(index)) {
			return undefined;
		}
		const { cached } = this;
		if (cached?.index === index && cached.rewrites === this.rewrites) {
			return cached.value;
		}
		const value = Array.from(this.items.subarray(this.offsets[index], this.offsets[index + 1]));
		this.cached = { index, rewrites: this.rewrites, value };
		return value;
	}

	/** How many items the array at `index` has, without making it, since making every array takes about as long as loading the log */
	override lengthAt(index: number): number {
		return this.offsets[index + 1]! - this.offsets[index]!;
	}

	/** Item `item` of the array at `index`, or `undefined` past its end, without making the array */
	itemAt(index: number, item: number): number | undefined {
		return item >= 0 && item < this.lengthAt(index) ? this.items[this.offsets[index]! + item] : undefined;
	}

	protected insertValue(index: number, value: Value): void {
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Samples are made for their entry's kind, see `createSamples()`
		const array = value as readonly number[];
		const { length, offsets } = this;
		const start = offsets[index]!;
		const end = offsets[length]!;
		this.items = grow(this.items, end + array.length);
		this.offsets = grow(offsets, length + 2);
		// Almost always added at the end, from a log
		if (start < end) {
			this.items.copyWithin(start + array.length, start, end);
		}
		this.items.set(array, start);
		for (let next = length + 1; next > index; next--) {
			this.offsets[next] = this.offsets[next - 1]! + array.length;
		}
	}

	protected removeValues(count: number): void {
		const { length, offsets } = this;
		const start = offsets[count]!;
		this.items.copyWithin(0, start, offsets[length]);
		for (let index = 0; index <= length - count; index++) {
			offsets[index] = offsets[index + count]! - start;
		}
	}

	copy(): Samples {
		const { length } = this;
		return new NumberArraySamples(
			this.timestamps.slice(0, length),
			this.items.slice(0, this.offsets[length]),
			this.offsets.slice(0, length + 1),
			length,
		);
	}

	toTransfer(): SamplesTransfer {
		return { timestamps: this.timestamps, length: this.length, items: this.items, offsets: this.offsets };
	}
}

/** Empty samples for an entry of `kind`, see `Samples` */
export function createSamples(kind: EntryKind): Samples {
	switch (kind) {
		case 'number':
			return new NumberSamples();
		case 'number[]':
			return new NumberArraySamples();
		default:
			return new ValueSamples();
	}
}

/** Samples another window or a worker sent, see `Samples.toTransfer()` */
export function fromTransfer(transfer: SamplesTransfer): Samples {
	const { timestamps, length } = transfer;
	if ('numbers' in transfer) {
		return new NumberSamples(timestamps, transfer.numbers, length);
	}
	if ('items' in transfer) {
		return new NumberArraySamples(timestamps, transfer.items, transfer.offsets, length);
	}
	if ('structs' in transfer) {
		return new StructSamples(timestamps, length, transfer.structs);
	}
	return new ValueSamples(timestamps, transfer.values);
}

/** The buffers of samples to transfer instead of copying, see `Samples.toTransfer()` */
export function transferables(transfer: SamplesTransfer): ArrayBuffer[] {
	if ('numbers' in transfer) {
		return [transfer.timestamps.buffer, transfer.numbers.buffer];
	}
	if ('items' in transfer) {
		return [transfer.timestamps.buffer, transfer.items.buffer, transfer.offsets.buffer];
	}
	if ('structs' in transfer) {
		return [transfer.timestamps.buffer, transfer.structs.bytes.buffer, transfer.structs.offsets.buffer];
	}
	return [transfer.timestamps.buffer];
}

/**
 * Remove at least `count` of the oldest samples across all of `samples`, keeping the latest sample of each.
 * Removes fewer if there aren't enough. Returns how many samples were removed.
 */
export function trimOldest(samples: readonly Samples[], count: number): number {
	const removableBefore = (time: number) =>
		samples.reduce((total, item) => total + Math.max(0, item.indexAtOrBefore(time)), 0);

	// Binary search for the earliest cutoff time that removes enough samples
	let low = Infinity;
	let high = -Infinity;
	for (const item of samples) {
		if (item.length > 0) {
			low = Math.min(low, item.timestamps[0]!);
			high = Math.max(high, item.timestamps[item.length - 1]!);
		}
	}
	for (let i = 0; i < 64 && low < high; i++) {
		const middle = (low + high) / 2;
		if (removableBefore(middle) >= count) {
			high = middle;
		} else {
			low = middle;
		}
	}

	return samples.reduce((total, item) => total + item.trimBefore(high), 0);
}
