import type { Entry, TimeRange } from '@/data/data-store';
import { getEntryKind, Samples, trimOldest, type Value } from '@/data/samples';

/**
 * Live history keeps at most this many samples across all entries, about 160 MB of numeric samples.
 * Past the limit the oldest samples are dropped, always keeping the latest value of every entry.
 */
export const maxLiveSamples = 10_000_000;

export type EntriesSnapshot = { readonly list: readonly Entry[]; readonly map: ReadonlyMap<string, Entry> };

/**
 * The entries and samples of one source, a log or the live session. Kept out of React state, the active data set is
 * published to React once per frame.
 */
export class DataSet {
	readonly entries = new Map<string, Entry>();
	/** When the live session was disconnected, sorted. Gaps still going on aren't included. */
	readonly gaps: TimeRange[] = [];
	/** When the live connection dropped, `undefined` while connected */
	disconnectedAt: number | undefined;
	start: number | undefined;
	end: number | undefined;
	/** Published once per frame */
	snapshot: EntriesSnapshot = { list: [], map: new Map() };
	timeRange: TimeRange | undefined;
	// Samples added with `addSample` since the last trim, an upper bound on how many samples are stored
	private sampleCount = 0;
	// `.type` entries whose group hasn't been checked for a Mechanism2d yet, see `addMechanismEntries()`
	private readonly uncheckedTypeEntries = new Set<Entry>();
	private entriesChanged = false;
	private dataChanged = false;

	// Called with the data set when it changes, so the changes are published by the next frame
	private readonly scheduleFlush: (data: DataSet) => void;

	constructor(scheduleFlush: (data: DataSet) => void) {
		this.scheduleFlush = scheduleFlush;
	}

	/** Add an entry, or replace it with an empty entry if its type changed. Updates the entry's metadata when `metadata` is given. */
	addEntry(name: string, type: string, samples = new Samples(), metadata?: Record<string, unknown>): Entry {
		const existing = this.entries.get(name);
		if (existing?.type === type) {
			if (metadata !== undefined) {
				this.setMetadata(existing, metadata);
			}
			return existing;
		}

		const entry: Entry = { name, type, kind: getEntryKind(type), samples, metadata: metadata ?? {} };
		this.entries.set(name, entry);
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

	/** Drop the history before `time` and start the source there, keeping the latest value of every entry */
	restart(time: number): void {
		this.sampleCount = 0;
		for (const samples of this.uniqueSamples()) {
			samples.trimBefore(time);
			this.sampleCount += samples.length;
		}
		this.gaps.length = 0;
		if (this.disconnectedAt !== undefined) {
			this.disconnectedAt = Math.max(this.disconnectedAt, time);
		}
		this.end = this.end === undefined ? undefined : Math.max(this.end, time);
		this.setStartTime(time);
	}

	/** Publish changes made since the last frame. Returns whether the entries and the data changed. */
	publish(): { entries: boolean; data: boolean } {
		this.addMechanismEntries();
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

	private changed(): void {
		this.dataChanged = true;
		this.scheduleFlush(this);
	}

	// Mechanism2d entries share their `.type` entry's samples, which must only be counted and trimmed once
	private uniqueSamples(): Samples[] {
		return [...new Set([...this.entries.values()].map((entry) => entry.samples))];
	}

	private trimHistory(): void {
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
}
