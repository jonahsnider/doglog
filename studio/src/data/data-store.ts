import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
import { useSyncExternalStore } from 'react';
import * as z from 'zod';
import { type EntryKind, getEntryKind, Samples, trimOldest, type Value } from '@/data/samples';

export type Entry = {
	/** Full name, ex. `/Robot/Arm/Angle` */
	readonly name: string;
	/** Type string from the source, ex. `double` or `struct:Pose2d` */
	readonly type: string;
	readonly kind: EntryKind;
	/** Mutated in place as data arrives, read it when rendering instead of copying it into React state */
	readonly samples: Samples;
	/** WPILOG entry metadata or NT4 topic properties, ex. `{ "unit": "deg" }`. Replaced when it changes, like `samples`. */
	metadata: Readonly<Record<string, unknown>>;
};

const metadataSchema = z.record(z.string(), z.unknown()).catch({});

/** Parse entry metadata from a WPILOG metadata string or NT4 topic properties, invalid metadata is empty */
export function parseMetadata(metadata: unknown): Record<string, unknown> {
	if (typeof metadata !== 'string') {
		return metadataSchema.parse(metadata);
	}
	try {
		return metadataSchema.parse(JSON.parse(metadata));
	} catch {
		return {};
	}
}

/** Times in microseconds, on the same clock as sample timestamps. @public */
export type TimeRange = {
	/** Start of the source (the first record of a log, or when a live connection began), shown as 0 s */
	readonly start: number;
	/** Newest sample timestamp */
	readonly end: number;
};

/**
 * Live history keeps at most this many samples across all entries, about 160 MB of numeric samples.
 * Past the limit the oldest samples are dropped, always keeping the latest value of every entry.
 */
export const maxLiveSamples = 10_000_000;

// Entries and samples of the active source. Kept out of React state, React only sees snapshots published once per frame.
let entries = new Map<string, Entry>();
let start: number | undefined;
let end: number | undefined;
// Samples added with `addSample` since the last trim, an upper bound on how many samples are stored
let sampleCount = 0;

// Only changes when entries are added or removed, not when samples are added
const entriesStore = createAtom<{ list: readonly Entry[]; map: ReadonlyMap<string, Entry> }>({
	list: [],
	map: new Map(),
});
let timeRange: TimeRange | undefined;
let dataVersion = 0;

// `.type` entries whose group hasn't been checked for a Mechanism2d yet, see `addMechanismEntries()`
const uncheckedTypeEntries = new Set<Entry>();

let entriesChanged = false;
let dataChanged = false;
let flushScheduled = false;

const dataListeners = new Set<() => void>();

/**
 * Add a `Mechanism2d` entry for each group of entries with a `.type` entry set to `Mechanism2d`, named after the group,
 * once the `.type` entry has a value. Widgets read the group's entries through it, see `@/data/mechanism`.
 */
function addMechanismEntries(): void {
	for (const typeEntry of uncheckedTypeEntries) {
		const type = typeEntry.samples.values[0];
		if (type === undefined) {
			continue;
		}
		uncheckedTypeEntries.delete(typeEntry);

		const name = typeEntry.name.slice(0, -'/.type'.length);
		if (type === 'Mechanism2d' && name !== '' && entries.get(typeEntry.name) === typeEntry && !entries.has(name)) {
			// Shares the `.type` entry's samples, so it has a value from when the mechanism was first logged
			entries.set(name, { name, type: 'Mechanism2d', kind: 'mechanism2d', samples: typeEntry.samples, metadata: {} });
			entriesChanged = true;
		}
	}
}

function flush(): void {
	flushScheduled = false;
	addMechanismEntries();

	if (entriesChanged) {
		entriesChanged = false;
		entriesStore.set({
			list: [...entries.values()].toSorted((a, b) => (a.name < b.name ? -1 : 1)),
			map: new Map(entries),
		});
	}

	if (dataChanged) {
		dataChanged = false;
		timeRange = start === undefined || end === undefined ? undefined : { start, end: Math.max(start, end) };
		dataVersion++;
		for (const listener of dataListeners) {
			listener();
		}
	}
}

function scheduleFlush(): void {
	if (!flushScheduled) {
		flushScheduled = true;
		requestAnimationFrame(flush);
	}
}

/** Remove all entries and samples, ex. when the active source is replaced */
export function clearData(): void {
	entries = new Map();
	uncheckedTypeEntries.clear();
	start = undefined;
	end = undefined;
	sampleCount = 0;
	entriesChanged = true;
	dataChanged = true;
	scheduleFlush();
}

/** Add an entry, or replace it with an empty entry if its type changed. Updates the entry's metadata when `metadata` is given. */
export function addEntry(
	name: string,
	type: string,
	samples = new Samples(),
	metadata?: Record<string, unknown>,
): Entry {
	const existing = entries.get(name);
	if (existing?.type === type) {
		if (metadata !== undefined) {
			setMetadata(existing, metadata);
		}
		return existing;
	}

	const entry: Entry = { name, type, kind: getEntryKind(type), samples, metadata: metadata ?? {} };
	entries.set(name, entry);
	if (name.endsWith('/.type')) {
		uncheckedTypeEntries.add(entry);
	}
	entriesChanged = true;
	scheduleFlush();
	return entry;
}

/** Replace an entry's metadata, ex. when NT4 topic properties change */
export function setMetadata(entry: Entry, metadata: Record<string, unknown>): void {
	entry.metadata = metadata;
	// Widgets re-render on data changes, metadata can change how they show values
	dataChanged = true;
	scheduleFlush();
}

/** Add a sample to an entry's history, dropping the oldest history once it gets too large */
export function addSample(entry: Entry, timestamp: number, value: Value): void {
	entry.samples.push(timestamp, value);
	extendTimeRange(timestamp, timestamp);

	sampleCount++;
	if (sampleCount > maxLiveSamples) {
		trimHistory();
	}
}

function trimHistory(): void {
	// Mechanism2d entries share their `.type` entry's samples, which must only be trimmed once
	const samples = [...new Set([...entries.values()].map((entry) => entry.samples))];
	sampleCount = samples.reduce((total, item) => total + item.length, 0);
	if (sampleCount > maxLiveSamples) {
		// Drop 10% extra so trimming (which copies every sample) only happens occasionally
		sampleCount -= trimOldest(samples, sampleCount - maxLiveSamples * 0.9);
	}
}

/** Widen the time range to include `first` through `last`, call after adding samples directly to `Entry.samples` */
export function extendTimeRange(first: number, last: number): void {
	start ??= first;
	end = end === undefined ? last : Math.max(end, last);
	dataChanged = true;
	scheduleFlush();
}

/** Set the start of the source, by default it's the first sample */
export function setStartTime(time: number): void {
	start = time;
	dataChanged = true;
	scheduleFlush();
}

/** @public */
export function getEntry(name: string): Entry | undefined {
	return entries.get(name);
}

/** @public */
export function getTimeRange(): TimeRange | undefined {
	return timeRange;
}

/**
 * Call `listener` at most once per frame when new samples arrive or the time range changes.
 * Useful for widgets that draw outside React, ex. on a canvas.
 * @public
 */
export function subscribeData(listener: () => void): () => void {
	dataListeners.add(listener);
	return () => {
		dataListeners.delete(listener);
	};
}

/** All entries of the active source, sorted by name. Doesn't change when samples are added. @public */
export function useEntries(): readonly Entry[] {
	return useSelector(entriesStore, (state) => state.list);
}

/** An entry of the active source by name, `undefined` if it doesn't exist. @public */
export function useEntry(name: string): Entry | undefined {
	return useSelector(entriesStore, (state) => state.map.get(name));
}

/** @public */
export function useTimeRange(): TimeRange | undefined {
	return useSyncExternalStore(subscribeData, getTimeRange);
}

/** A number that changes at most once per frame when new samples arrive, use it to re-render when data changes. @public */
export function useDataVersion(): number {
	return useSyncExternalStore(subscribeData, () => dataVersion);
}
