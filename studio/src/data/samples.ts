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

/**
 * Time-ordered samples of one entry.
 * Timestamps are in microseconds, `timestamps[i]` is the time of `values[i]`, and only the first `length` items are used.
 */
export class Samples {
	timestamps: Float64Array<ArrayBuffer>;
	values: Value[];
	/** Changes when samples are removed or inserted before the latest one, so copies made from them know to start over */
	rewrites = 0;

	constructor(timestamps: Float64Array<ArrayBuffer> = new Float64Array(16), values: Value[] = []) {
		this.timestamps = timestamps;
		this.values = values;
	}

	get length(): number {
		return this.values.length;
	}

	/** Add a sample, keeping samples sorted by time */
	push(timestamp: number, value: Value): void {
		const length = this.length;

		if (length === this.timestamps.length) {
			const grown = new Float64Array(Math.max(16, length * 2));
			grown.set(this.timestamps);
			this.timestamps = grown;
		}

		if (length === 0 || timestamp >= this.timestamps[length - 1]!) {
			this.timestamps[length] = timestamp;
			this.values.push(value);
			return;
		}

		// Rare: a sample arrived out of order, insert it after any samples with the same timestamp
		const index = this.indexAtOrBefore(timestamp) + 1;
		this.timestamps.copyWithin(index + 1, index, length);
		this.timestamps[index] = timestamp;
		this.values.splice(index, 0, value);
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
		return this.values[this.indexAtOrBefore(time)];
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
		this.values.splice(0, count);
		this.rewrites++;
		return count;
	}
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
