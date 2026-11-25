import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
import { useSyncExternalStore } from 'react';
import type { StructDeclaration } from 'wpilib-struct';
import * as z from 'zod';
import { DataSet } from '@/data/data-set';
import type { EntryKind } from '@/data/entry-kind';
import type { Samples } from '@/data/samples';

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
 * The time (µs) on the clock live sample timestamps use, so history stays in order when the robot reboots and its clock
 * resets
 */
export function liveTime(): number {
	return (performance.timeOrigin + performance.now()) * 1000;
}

export function createDataSet(): DataSet {
	return new DataSet(scheduleFlush);
}

// The displayed data is normally the selected source, except while previewing a video of live history.
let sourceData = createDataSet();
let active = sourceData;
const changedSets = new Set<DataSet>();
let flushScheduled = false;

// Only changes when entries are added or removed, not when samples are added
const entriesStore = createAtom(active.snapshot);
let dataVersion = 0;
const dataListeners = new Set<() => void>();

function notifyData(): void {
	dataVersion++;
	for (const listener of dataListeners) {
		listener();
	}
}

function flush(): void {
	flushScheduled = false;
	for (const data of changedSets) {
		const changes = data.publish();
		if (data !== active) {
			continue;
		}
		if (changes.entries) {
			entriesStore.set(data.snapshot);
		}
		if (changes.data) {
			notifyData();
		}
	}
	changedSets.clear();
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
	active.publish();
	changedSets.delete(active);
	entriesStore.set(active.snapshot);
	notifyData();
}

/** Show `data` in every dashboard and widget, or nothing when `undefined` */
export function setActiveData(data: DataSet | undefined): void {
	sourceData = data ?? createDataSet();
	showData(sourceData);
}

/** The selected source, also used to keep the same graph view when replaying its history */
export function getSourceData(): DataSet {
	return sourceData;
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

/** All entries of the active source, sorted by name. Doesn't change when samples are added. */
export function getEntries(): readonly Entry[] {
	return entriesStore.get().list;
}

/** @public */
export function getEntry(name: string): Entry | undefined {
	return active.entries.get(name);
}

export function getStructSchemas(): ReadonlyMap<string, readonly StructDeclaration[]> {
	return active.structSchemas;
}

/** @public */
export function getTimeRange(): TimeRange | undefined {
	return active.timeRange;
}

/** When the active live session, or the live session a log recorded, was disconnected, sorted */
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
