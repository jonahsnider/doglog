import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
import { useSyncExternalStore } from 'react';
import type { StructDeclaration } from 'wpilib-struct';
import * as z from 'zod';
import { DataSet } from '@/data/data-set';
import type { EntryKind } from '@/data/entry-kind';
import { findEntry, type Samples } from '@/data/samples';

export type Entry = {
	/** Full name, ex. `/Robot/Arm/Angle` */
	readonly name: string;
	/** Type string from the source, ex. `double` or `struct:Pose2d` */
	readonly type: string;
	readonly kind: EntryKind;
	/** Mutated in place as data arrives, read it when rendering instead of copying it into React state */
	readonly samples: Samples;
	metadata: Readonly<Record<string, unknown>>;
	/** For a log's entry with a log embedded in it, the embedded log's file, see `embeddedLogFormat` */
	embeddedLog?: Uint8Array<ArrayBuffer>;
	/** For a HOOT device's entry renamed by a robot project, see `nameDevices()` */
	device?: {
		/** The entry's name in the log, ex. `/Phoenix6/rio/TalonFX-11/Velocity` */
		readonly original: string;
		/** The device's model and ID, ex. `TalonFX-11` */
		readonly id: string;
		/** The robot that named it */
		readonly robot: string;
	};
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
	/** Start of the source (the first record of a log, or when a live connection began) */
	readonly start: number;
	/** Newest sample timestamp */
	readonly end: number;
};

/** The time range of every visible source. Its earliest start is displayed as 0 s. */
export type SourcesRange = TimeRange & {
	/** Start of the top visible source with data, which can be later than the displayed 0 s. */
	readonly origin: number;
};

/**
 * The time (µs) on the clock live sample timestamps use, so history stays in order when the robot reboots and its clock
 * resets
 */
export function liveTime(): number {
	return (performance.timeOrigin + performance.now()) * 1000;
}

export function createDataSet(): DataSet {
	return new DataSet(scheduleFlush);
}

// The time base, the top visible source, is normally what's displayed, except while previewing a video of live history
let sourceData = createDataSet();
let active = sourceData;
// Every visible source, the time base first, see `setVisibleData()`
let visible: readonly DataSet[] = [];
let visibleSet: ReadonlySet<DataSet> = new Set();
// Whether the time range ends at the time base's newest data, ex. for the live session
let endsAtTimeBase = false;
let timeRange: SourcesRange | undefined;
const changedSets = new Set<DataSet>();
let flushScheduled = false;

// Only changes when entries are added or removed, not when samples are added
const entriesStore = createAtom(active.snapshot);
/** The entries of each visible source, the time base first */
export type VisibleEntries = readonly { readonly data: DataSet; readonly map: ReadonlyMap<string, Entry> }[];
// Like `entriesStore`, for every visible source
const visibleEntriesStore = createAtom<VisibleEntries>([]);

function publishVisibleEntries(): void {
	visibleEntriesStore.set(getVisibleData().map((data) => ({ data, map: data.snapshot.map })));
}
let dataVersion = 0;
const dataListeners = new Set<() => void>();

function updateTimeRange(): void {
	const sets = active === sourceData ? visible : [active];
	const ranges = sets.flatMap((data) => (data.timeRange ? [data.timeRange] : []));
	// Until the time base has data, ex. while connecting, the next source with data is
	const origin = ranges[0]?.start;
	if (origin === undefined) {
		timeRange = undefined;
		return;
	}
	const start = Math.min(...ranges.map((range) => range.start));
	const timeBaseEnd = active.timeRange?.end;
	const end = endsAtTimeBase && timeBaseEnd !== undefined ? timeBaseEnd : Math.max(...ranges.map((range) => range.end));
	timeRange = { start, end: Math.max(start, end), origin };
}

function notifyData(): void {
	updateTimeRange();
	dataVersion++;
	for (const listener of dataListeners) {
		listener();
	}
}

function flush(): void {
	flushScheduled = false;
	let entriesChanged = false;
	let dataChanged = false;
	for (const data of changedSets) {
		const changes = data.publish();
		if (data !== active && !(active === sourceData && visibleSet.has(data))) {
			continue;
		}
		if (changes.entries && data === active) {
			entriesStore.set(data.snapshot);
		}
		entriesChanged ||= changes.entries;
		dataChanged ||= changes.data;
	}
	changedSets.clear();
	if (entriesChanged) {
		publishVisibleEntries();
	}
	if (dataChanged) {
		notifyData();
	}
}

function scheduleFlush(data: DataSet): void {
	changedSets.add(data);
	if (!flushScheduled) {
		flushScheduled = true;
		requestAnimationFrame(flush);
	}
}

function showData(data: DataSet): void {
	active = data;
	for (const other of active === sourceData ? visible : [active]) {
		other.publish();
		changedSets.delete(other);
	}
	entriesStore.set(active.snapshot);
	publishVisibleEntries();
	notifyData();
}

/**
 * Show every source in `data` in every dashboard and widget, or nothing when it's empty. The first is the time base,
 * whose entries are listed. `live` ends the time range at the time base's newest data.
 */
export function setVisibleData(data: readonly DataSet[], live = false): void {
	visible = data;
	visibleSet = new Set(data);
	endsAtTimeBase = live;
	sourceData = data[0] ?? createDataSet();
	showData(sourceData);
}

/** Show `data` alone in every dashboard and widget, or nothing when `undefined` */
export function setActiveData(data: DataSet | undefined): void {
	setVisibleData(data ? [data] : []);
}

/** The time base, the top visible source, also used to keep the same graph view when replaying its history */
export function getSourceData(): DataSet {
	return sourceData;
}

/** Every visible source, the time base first. Only the time base while replaying live history. */
function getVisibleData(): readonly DataSet[] {
	return active === sourceData ? visible : [active];
}

/** Show a stable copy of the live history. Returns how to resume showing incoming data. */
export function replayLiveHistory(): () => void {
	const replay = sourceData.copyForReplay();
	showData(replay);
	return () => {
		if (active === replay) {
			showData(sourceData);
		}
	};
}

/** Publish entries and samples added since the last frame right away, ex. to read them right after a log loads */
export function flushData(): void {
	if (flushScheduled) {
		flush();
	}
}

/** An entry of the time base by name, see `findEntry()`. @public */
export function getEntry(name: string): Entry | undefined {
	return findEntry(active.entries, name);
}

/** An entry by name from the top visible source that has it, see `findEntry()` */
export function getVisibleEntry(name: string): Entry | undefined {
	for (const { map } of visibleEntriesStore.get()) {
		const entry = findEntry(map, name);
		if (entry) {
			return entry;
		}
	}
	return getEntry(name);
}

export function getStructSchemas(): ReadonlyMap<string, readonly StructDeclaration[]> {
	return active.structSchemas;
}

/** The range of every visible source, on the time base's clock. @public */
export function getTimeRange(): SourcesRange | undefined {
	return timeRange;
}

/** When the time base's live session, or the live session it recorded, was disconnected, sorted */
export function getGaps(): readonly TimeRange[] {
	return active.gaps;
}

/**
 * Call `listener` at most once per frame when new samples arrive or the time range changes, and when the active source
 * changes. Useful for widgets that draw outside React, ex. on a canvas.
 * @public
 */
export function subscribeData(listener: () => void): () => void {
	dataListeners.add(listener);
	return () => {
		dataListeners.delete(listener);
	};
}

/** All entries of the time base, sorted by name. Doesn't change when samples are added. @public */
export function useEntries(): readonly Entry[] {
	return useSelector(entriesStore, (state) => state.list);
}

/** An entry of the time base by name, see `findEntry()`. `undefined` if it doesn't exist. @public */
export function useEntry(name: string): Entry | undefined {
	return useSelector(entriesStore, (state) => findEntry(state.map, name));
}

/** The entries of each visible source, the time base first. Pass `names` only if reading just those entries. */
export function useVisibleEntries(names?: readonly string[]): VisibleEntries {
	return useSelector(visibleEntriesStore, undefined, {
		compare: (before, after) =>
			before === after ||
			(names !== undefined &&
				before.length === after.length &&
				before.every(({ data, map }, index) => {
					const next = after[index]!;
					return data === next.data && names.every((name) => findEntry(map, name) === findEntry(next.map, name));
				})),
	});
}

/** The entries of each visible source, the time base first */
export function getVisibleEntries(): VisibleEntries {
	return visibleEntriesStore.get();
}

/** @public */
export function useTimeRange(): SourcesRange | undefined {
	return useSyncExternalStore(subscribeData, getTimeRange);
}

/** A number that changes at most once per frame when new samples arrive, use it to re-render when data changes. @public */
export function useDataVersion(): number {
	return useSyncExternalStore(subscribeData, () => dataVersion);
}
