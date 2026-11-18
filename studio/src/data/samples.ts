import type { StructPayload } from 'wpilog-parser';
import type { EntryKind } from '@/data/entry-kind';

/** A decoded value of a supported entry type */
export type Value = number | boolean | string | number[] | boolean[] | string[] | StructPayload | StructPayload[];

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

	// Protobuf, msgpack, raw bytes, etc.
	return 'unsupported';
}

/** Type string shown to users, ex. `Pose2d` for `struct:Pose2d` */
export function formatEntryType(type: string): string {
	return type.startsWith('struct:') ? type.slice('struct:'.length) : type;
}

/** Whether an entry holds schemas used to decode other entries (ex. `/.schema/struct:Pose2d`), these are hidden from users */
export function isSchemaEntry(name: string): boolean {
	return name.startsWith('/.schema/');
}

/** Topics Studio uses to share dashboards, see `@/sharing/nt-sync` */
export const studioTopicPrefix = '/DogLogStudio/';

/** Studio's own topics, and robot logs' copies of them, aren't data to show */
export function isStudioEntry(name: string): boolean {
	return name.startsWith(studioTopicPrefix) || name.startsWith(`/NT:${studioTopicPrefix}`);
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
	}

	/** Index of the latest sample at or before `time`, or -1 if there is none */
	indexAtOrBefore(time: number): number {
		let low = 0;
		let high = this.length;
		// Find the first sample after `time`
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
