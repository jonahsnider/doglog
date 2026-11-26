// oxlint-disable max-lines -- Moving and copying data sets for other windows is kept with the data they change
import type { StructDeclaration } from 'wpilib-struct';
import type { Entry, TimeRange } from '@/data/data-store';
import { type FieldKey, FieldEntry, structFieldType } from '@/data/field-entry';
import { getEntryKind, Samples, trimOldest, type Value } from '@/data/samples';

/**
 * Live history keeps at most this many samples across all entries, about 160 MB of numeric samples.
 * Past the limit the oldest samples are dropped, always keeping the latest value of every entry.
 */
export const maxLiveSamples = 10_000_000;

export type EntriesSnapshot = { readonly list: readonly Entry[]; readonly map: ReadonlyMap<string, Entry> };

/** A data set copied to send to another window, see `DataSet.toTransfer()` */
export type DataSetTransfer = {
	entries: {
		name: string;
		type: string;
		timestamps: Float64Array<ArrayBuffer>;
		values: Value[];
		metadata: Readonly<Record<string, unknown>>;
		embeddedLog?: Uint8Array<ArrayBuffer>;
	}[];
	structSchemas: [string, readonly StructDeclaration[]][];
	gaps: TimeRange[];
	disconnectedAt: number | undefined;
	start: number | undefined;
	end: number | undefined;
	offset: number;
};

/**
 * The entries and samples of one source, a log or the live session. Kept out of React state, the active data set is
 * published to React once per frame.
 */
export class DataSet {
	readonly entries = new Map<string, Entry>();
	/** Struct schemas by struct name, ex. `Pose2d` */
	readonly structSchemas: Map<string, readonly StructDeclaration[]>;
	/** When the live session, or the live session a log recorded, was disconnected, sorted. Gaps still going on aren't included. */
	readonly gaps: TimeRange[] = [];
	/** When the live connection dropped, `undefined` while connected */
	disconnectedAt: number | undefined;
	start: number | undefined;
	end: number | undefined;
	/** How far (µs) samples have been moved from the source's own clock, see `shift()` */
	offset = 0;
	/** Published once per frame */
	snapshot: EntriesSnapshot = { list: [], map: new Map() };
	timeRange: TimeRange | undefined;
	// Samples added with `addSample` since the last trim, an upper bound on how many samples are stored
	private sampleCount = 0;
	// `.type` entries whose group hasn't been checked for a Mechanism2d yet, see `addMechanismEntries()`
	private readonly uncheckedTypeEntries = new Set<Entry>();
	// Logged arrays, how many of their samples were checked, and the longest value in them
	private readonly arrays = new Map<Entry, { checked: number; length: number }>();
	// Struct entries whose fields haven't been added yet, until their schema arrives
	private readonly unexpandedStructs = new Set<Entry>();
	private entriesChanged = false;
	private dataChanged = false;

	// Called with the data set when it changes, so the changes are published by the next frame
	private readonly scheduleFlush: (data: DataSet) => void;

	constructor(scheduleFlush: (data: DataSet) => void, structSchemas?: DataSet['structSchemas']) {
		this.scheduleFlush = scheduleFlush;
		this.structSchemas = new Map(structSchemas);
	}

	/** Add an entry, or replace it with an empty entry if its type changed. Updates the entry's metadata when `metadata` is given. */
	addEntry(name: string, type: string, samples = new Samples(), metadata?: Record<string, unknown>): Entry {
		const existing = this.entries.get(name);
		// A logged entry replaces a field entry with the same name
		if (existing?.type === type && !(existing instanceof FieldEntry)) {
			if (metadata !== undefined) {
				this.setMetadata(existing, metadata);
			}
			return existing;
		}
		if (existing) {
			this.removeFields(existing);
		}

		const entry: Entry = { name, type, kind: getEntryKind(type), samples, metadata: metadata ?? {} };
		this.entries.set(name, entry);
		if (entry.kind === 'struct') {
			this.unexpandedStructs.add(entry);
		} else if (entry.kind.endsWith('[]')) {
			this.arrays.set(entry, { checked: 0, length: 0 });
		}
		if (name.endsWith('/.type')) {
			this.uncheckedTypeEntries.add(entry);
		}
		this.entriesChanged = true;
		this.scheduleFlush(this);
		return entry;
	}

	/** Replace an entry's metadata, ex. when NT4 topic properties change */
	setMetadata(entry: Entry, metadata: Record<string, unknown>): void {
		entry.metadata = metadata;
		// Widgets re-render on data changes, metadata can change how they show values
		this.changed();
	}

	/** Add a struct schema, so entries of that struct get an entry for each field */
	addStructSchema(name: string, fields: readonly StructDeclaration[]): void {
		this.structSchemas.set(name, fields);
		this.changed();
	}

	/** Add a sample to an entry's history, dropping the oldest history once it gets too large */
	addSample(entry: Entry, timestamp: number, value: Value): void {
		entry.samples.push(timestamp, value);
		this.extendTimeRange(timestamp, timestamp);

		this.sampleCount++;
		if (this.sampleCount > maxLiveSamples) {
			this.trimHistory();
		}
	}

	/** Widen the time range to include `first` through `last`, call after adding samples directly to `Entry.samples` */
	extendTimeRange(first: number, last: number): void {
		this.start ??= first;
		this.end = this.end === undefined ? last : Math.max(this.end, last);
		this.changed();
	}

	/** Set the start of the source, by default it's the first sample */
	setStartTime(time: number): void {
		this.start = time;
		this.changed();
	}

	/**
	 * Move every sample `delta` µs later, ex. to line a log up with other sources. Sources in a window share one clock, so
	 * widgets read them all at the cursor time. `offset` is how far the data has been moved from its own clock in total.
	 */
	shift(delta: number): void {
		if (delta === 0) {
			return;
		}
		this.offset += delta;
		for (const samples of this.uniqueSamples()) {
			for (let index = 0; index < samples.length; index++) {
				samples.timestamps[index]! += delta;
			}
			// Field entries and anything else that copied the samples start over
			samples.rewrites++;
		}
		for (const [index, gap] of this.gaps.entries()) {
			this.gaps[index] = { start: gap.start + delta, end: gap.end + delta };
		}
		if (this.disconnectedAt !== undefined) {
			this.disconnectedAt += delta;
		}
		if (this.start !== undefined) {
			this.start += delta;
		}
		if (this.end !== undefined) {
			this.end += delta;
		}
		this.changed();
	}

	/** Record that the live connection dropped at `time` */
	disconnect(time: number): void {
		this.disconnectedAt ??= time;
	}

	/** Record that the live connection was made at `time`, adding a gap since it dropped */
	connect(time: number): void {
		if (this.disconnectedAt !== undefined && this.disconnectedAt < time) {
			this.gaps.push({ start: this.disconnectedAt, end: time });
			this.changed();
		}
		this.disconnectedAt = undefined;
	}

	/** Publish changes made since the last frame. Returns whether the entries and the data changed. */
	publish(): { entries: boolean; data: boolean } {
		this.addMechanismEntries();
		this.addFieldEntries();
		const changes = { entries: this.entriesChanged, data: this.dataChanged };
		if (this.entriesChanged) {
			this.entriesChanged = false;
			this.snapshot = {
				list: [...this.entries.values()].toSorted((a, b) => (a.name < b.name ? -1 : 1)),
				map: new Map(this.entries),
			};
		}
		if (this.dataChanged) {
			this.dataChanged = false;
			this.timeRange =
				this.start === undefined || this.end === undefined
					? undefined
					: { start: this.start, end: Math.max(this.start, this.end) };
		}
		return changes;
	}

	/** Copy the data to send to another window. Entries the data set adds itself, like struct fields, are added again there. */
	toTransfer(): DataSetTransfer {
		const logged = [...this.entries.values()].filter(
			(entry) => !(entry instanceof FieldEntry) && entry.kind !== 'mechanism2d',
		);
		return {
			// oxlint-disable-next-line oxc/no-map-spread -- Each entry is copied anyway, to send to the other window
			entries: logged.map(({ name, type, samples, metadata, embeddedLog }) => ({
				name,
				type,
				timestamps: samples.timestamps.slice(0, samples.length),
				values: samples.values.slice(),
				metadata,
				...(embeddedLog && { embeddedLog }),
			})),
			structSchemas: [...this.structSchemas],
			gaps: [...this.gaps],
			disconnectedAt: this.disconnectedAt,
			start: this.start,
			end: this.end,
			offset: this.offset,
		};
	}

	/** Add the data another window sent, see `toTransfer()`. Call on an empty data set. */
	addTransfer(transfer: DataSetTransfer): void {
		for (const [name, fields] of transfer.structSchemas) {
			this.structSchemas.set(name, fields);
		}
		for (const { name, type, timestamps, values, metadata, embeddedLog } of transfer.entries) {
			const entry = this.addEntry(name, type, new Samples(timestamps, values), { ...metadata });
			if (embeddedLog) {
				entry.embeddedLog = embeddedLog;
			}
		}
		this.gaps.push(...transfer.gaps);
		this.disconnectedAt = transfer.disconnectedAt;
		this.start = transfer.start;
		this.end = transfer.end;
		this.offset = transfer.offset;
		this.changed();
	}

	/** Copy the displayed history for replay while the live data set keeps receiving and dropping samples. */
	copyForReplay(): DataSet {
		const replay = new DataSet(() => {}, this.structSchemas);
		const histories = new Map<Samples, Samples>();
		const list = this.snapshot.list.map((entry) => {
			let copy: Entry;
			if (entry instanceof FieldEntry) {
				// Roots sort before their fields, which stay lazy and read the copied samples.
				copy = new FieldEntry(replay.entries.get(entry.root.name)!, entry.path, entry.type);
			} else {
				const from = entry.samples;
				const samples = histories.get(from) ?? new Samples(from.timestamps.slice(0, from.length), from.values.slice());
				histories.set(from, samples);
				copy = { ...entry, samples };
			}
			replay.entries.set(copy.name, copy);
			return copy;
		});
		replay.snapshot = { list, map: replay.entries };
		replay.gaps.push(...this.gaps);
		replay.timeRange = this.timeRange;
		return replay;
	}

	private changed(): void {
		this.dataChanged = true;
		this.scheduleFlush(this);
	}

	// Mechanism2d entries share their `.type` entry's samples, which must only be counted and trimmed once.
	// Field entries copy their samples from logged entries as they're read, and start over when those are trimmed.
	private uniqueSamples(): Samples[] {
		const logged = [...this.entries.values()].filter((entry) => !(entry instanceof FieldEntry));
		return [...new Set(logged.map((entry) => entry.samples))];
	}

	/** Drop the oldest history if there's too much, ex. after adding a restored live session's samples directly */
	trimHistory(): void {
		const samples = this.uniqueSamples();
		this.sampleCount = samples.reduce((total, item) => total + item.length, 0);
		if (this.sampleCount > maxLiveSamples) {
			// Drop 10% extra so trimming (which copies every sample) only happens occasionally
			this.sampleCount -= trimOldest(samples, this.sampleCount - maxLiveSamples * 0.9);
		}
	}

	/**
	 * Add a `Mechanism2d` entry for each group of entries with a `.type` entry set to `Mechanism2d`, named after the group,
	 * once the `.type` entry has a value. Widgets read the group's entries through it, see `@/data/mechanism`.
	 */
	private addMechanismEntries(): void {
		for (const typeEntry of this.uncheckedTypeEntries) {
			const type = typeEntry.samples.values[0];
			if (type === undefined) {
				continue;
			}
			this.uncheckedTypeEntries.delete(typeEntry);

			const name = typeEntry.name.slice(0, -'/.type'.length);
			if (
				type === 'Mechanism2d' &&
				name !== '' &&
				this.entries.get(typeEntry.name) === typeEntry &&
				!this.entries.has(name)
			) {
				// Shares the `.type` entry's samples, so it has a value from when the mechanism was first logged
				this.entries.set(name, {
					name,
					type: 'Mechanism2d',
					kind: 'mechanism2d',
					samples: typeEntry.samples,
					metadata: {},
				});
				this.entriesChanged = true;
			}
		}
	}

	/**
	 * Add an entry for each element of logged arrays, up to the longest value logged so far, and each field of structs
	 * whose schema is known, nested as deep as they go. See `FieldEntry`.
	 */
	private addFieldEntries(): void {
		for (const [entry, array] of this.arrays) {
			const { values, length } = entry.samples;
			// Trimmed live history, check what's left
			if (array.checked > length) {
				array.checked = 0;
			}
			let longest = array.length;
			for (let index = array.checked; index < length; index++) {
				const value = values[index];
				if (Array.isArray(value) && value.length > longest) {
					longest = value.length;
				}
			}
			for (let index = array.length; index < longest; index++) {
				this.addField(entry, index, entry.type.slice(0, -'[]'.length));
			}
			array.checked = length;
			array.length = longest;
		}

		// Nested structs added while expanding one are expanded in the same loop
		for (const entry of this.unexpandedStructs) {
			const fields = this.structSchemas.get(entry.type.slice('struct:'.length));
			if (fields === undefined) {
				continue;
			}
			this.unexpandedStructs.delete(entry);
			for (const field of fields) {
				const type = structFieldType(field);
				this.addField(entry, field.name, type, type.endsWith('[]') ? field.arraySize : undefined);
			}
		}
	}

	/** Add a field entry, and the elements of struct array fields, which have a fixed `length` */
	private addField(parent: Entry, key: FieldKey, type: string, length?: number): void {
		const field =
			parent instanceof FieldEntry
				? new FieldEntry(parent.root, [...parent.path, key], type)
				: new FieldEntry(parent, [key], type);
		if (this.entries.has(field.name)) {
			return;
		}
		this.entries.set(field.name, field);
		this.entriesChanged = true;
		if (field.kind === 'struct') {
			this.unexpandedStructs.add(field);
		}
		for (let index = 0; index < (length ?? 0); index++) {
			this.addField(field, index, type.slice(0, -'[]'.length));
		}
	}

	/** Remove the field entries of an entry that's being replaced */
	private removeFields(entry: Entry): void {
		this.arrays.delete(entry);
		this.unexpandedStructs.delete(entry);
		const prefix = `${entry.name}/`;
		for (const [name, other] of this.entries) {
			if (other instanceof FieldEntry && name.startsWith(prefix)) {
				this.entries.delete(name);
				this.unexpandedStructs.delete(other);
			}
		}
	}
}
