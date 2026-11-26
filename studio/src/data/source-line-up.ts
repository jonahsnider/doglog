import type { DataSet } from '@/data/data-set';
import { subscribeData } from '@/data/data-store';
import { lineUpOffset } from '@/data/line-up';
import { findEntry } from '@/data/samples';
import {
	getSource,
	sourceData,
	sourceId,
	sourcesStore,
	sourceState,
	updateLog,
	visibleSources,
} from '@/data/source-store';
import { getModePeriods } from '@/timeline/events';

/**
 * How far a log is moved from where it would be if its clock matched the time base's, `undefined` for the time base
 * itself or a log that isn't loaded
 */
export function logOffset(id: string): number | undefined {
	const timeBase = getSource();
	const data = sourceState.logData.get(id);
	const base = timeBase && sourceData(timeBase);
	if (data === undefined || base === undefined || timeBase === undefined || sourceId(timeBase) === id) {
		return undefined;
	}
	return data.offset - base.offset;
}

/** Move a log so it's `offset` from where it would be if its clock matched the time base's, see `logOffset()` */
export function setLogOffset(id: string, offset: number): void {
	const current = logOffset(id);
	if (current === undefined) {
		return;
	}
	sourceState.logData.get(id)!.shift(offset - current);
	updateLog(id, { manualOffset: true });
}

/** What a log lines up with: the live session's latest enable, or the time base. `undefined` for the only source. */
function lineUpBase(id: string): { data: DataSet; latestEnable: boolean } | undefined {
	const live = sourceState.liveData;
	if (live?.timeRange !== undefined) {
		return { data: live, latestEnable: true };
	}
	if (sourcesStore.get().live !== undefined) {
		// Lined up once the live session has data, see `watchLiveLineUp()`
		return undefined;
	}
	const base = visibleSources(sourcesStore.get()).find(
		(source) => sourceId(source) !== id && source.status === 'loaded',
	);
	const data = base && sourceData(base);
	return data?.timeRange === undefined ? undefined : { data, latestEnable: false };
}

/** Line a log up with the other sources, see the data-sources spec's line up sources */
export function lineUpLog(id: string): void {
	const data = sourceState.logData.get(id);
	const base = lineUpBase(id);
	if (data === undefined || base === undefined) {
		return;
	}
	data.shift(lineUpOffset(base.data, data, base.latestEnable));
	updateLog(id, { manualOffset: undefined });
}

/** The offset lining a log up again would give it, see `logOffset()` and `lineUpLog()` */
export function automaticLogOffset(id: string): number | undefined {
	const current = logOffset(id);
	const data = sourceState.logData.get(id);
	const base = lineUpBase(id);
	if (current === undefined || data === undefined || base === undefined) {
		return undefined;
	}
	return current + lineUpOffset(base.data, data, base.latestEnable);
}

/** Line every log the user didn't move up with the live session's latest enable */
export function lineUpWithLatestEnable(includeManual = true): void {
	for (const log of sourcesStore.get().logs) {
		if (log.status === 'loaded' && (includeManual || log.manualOffset !== true)) {
			lineUpLog(log.id);
		}
	}
}

// Logs line up with the live session's start once it has data, then its first enable once it happens
let liveLineUp: 'data' | 'enable' | 'done' = 'done';

/** Start lining logs up with a new live session once it has data or once it's enabled */
export function setLiveLineUp(state: 'data' | 'enable'): void {
	liveLineUp = state;
}
let lastLiveCheck = 0;

/** Line logs up with the live session once it has data, then once it's enabled, see `setLiveLineUp()` */
export function watchLiveLineUp(): void {
	const live = sourceState.liveData;
	if (live === undefined || liveLineUp === 'done' || live.timeRange === undefined) {
		return;
	}
	const now = performance.now();
	if (liveLineUp === 'enable' && now - lastLiveCheck < 500) {
		return;
	}
	lastLiveCheck = now;
	const enabled = getModePeriods(live.timeRange, (name) => findEntry(live.entries, name)).some(
		(period) => period.mode !== 'disabled' && period.mode !== 'estop',
	);
	if (liveLineUp === 'data' || enabled) {
		liveLineUp = enabled ? 'done' : 'enable';
		lineUpWithLatestEnable(false);
	}
}

subscribeData(watchLiveLineUp);
