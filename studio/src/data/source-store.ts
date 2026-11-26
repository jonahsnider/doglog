import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
import type { DataSet } from '@/data/data-set';
import { type Entry, setVisibleData } from '@/data/data-store';
import { saveDevLog } from '@/data/dev-log';
import { findEntry } from '@/data/samples';
import type { LiveStatus } from '@/data/live-source';
import type { UnreadEnd } from '@/data/log-source';
import { deleteLiveRecording } from '@/data/recording';
import { simulatorHost } from '@/robot-target';
import { setTimeBase } from '@/timeline/timeline';
import { keepViewWidth, showWholeSource } from '@/widgets/graph/view';

export type LogSource = {
	type: 'log';
	/** Tells apart logs in the window */
	id: string;
	fileName: string;
	status: 'loading' | 'loaded';
	/** Whether the in-progress load can be canceled by the user (ex. a network download) */
	cancelable?: boolean;
	/** The end of the file that couldn't be read, unset when it's no more than a partial last record */
	unread?: UnreadEnd;
	/** Kept open but not drawn, see `toggleHidden()` */
	hidden?: boolean;
	/** The user changed its time offset, so it isn't lined up automatically */
	manualOffset?: boolean;
};

export type LiveSource = { type: 'live'; host: string; status: LiveStatus; hidden?: boolean };

/** A data source. A window has any number of logs and at most one live session, and shows every visible one at once. */
export type Source = LogSource | LiveSource;

/** The window's live session and logs, in the order they're listed */
export type Sources = { readonly live?: LiveSource; readonly logs: readonly LogSource[] };

export const sourcesStore = createAtom<Sources>({ logs: [] });
// Kept apart from the sources so progress updates don't rerender everything that uses them
export const logProgressStore = createAtom<number | undefined>(0);
/** The source whose row was just pointed out, ex. when the user opens a log that's already open */
export const highlightedSourceStore = createAtom<{ id: string; count: number } | undefined>(undefined);

export const sourceState: {
	logData: Map<string, DataSet>;
	stopLog: Map<string, () => void>;
	liveData: DataSet | undefined;
	stopLive: (() => void) | undefined;
	// Changes every time the live session is replaced or stopped, so slow requests can tell they're outdated
	liveGeneration: number;
} = {
	logData: new Map(),
	stopLog: new Map(),
	liveData: undefined,
	stopLive: undefined,
	liveGeneration: 0,
};

/** The ID of a source, the live session's is `live` */
export function sourceId(source: Source): string {
	return source.type === 'live' ? 'live' : source.id;
}

/** Every source, the live session first */
export function sourceList({ live, logs }: Sources): Source[] {
	return live ? [live, ...logs] : [...logs];
}

/**
 * The sources drawn in widgets, the time base first. A log is drawn once it's loaded, since it's lined up with the
 * others then, except the first log of a window without other sources, which is drawn as it loads.
 */
export function visibleSources(sources: Sources): Source[] {
	const shown = sourceList(sources).filter((source) => source.hidden !== true);
	const ready = shown.filter((source) => source.status !== 'loading');
	if (ready.length > 0) {
		return ready;
	}
	return shown.slice(0, 1);
}

/** The data of a source, `undefined` once it's closed */
export function sourceData(source: Source): DataSet | undefined {
	return source.type === 'live' ? sourceState.liveData : sourceState.logData.get(source.id);
}

/** The time base, the top visible source, whose clock and robot mode the timeline uses */
export function useSource(): Source | undefined {
	return useSelector(sourcesStore, (sources) => visibleSources(sources)[0]);
}

/** The time base, the top visible source, whose clock and robot mode the timeline uses */
export function getSource(): Source | undefined {
	return visibleSources(sourcesStore.get())[0];
}

/** The window's live session and logs */
export function getSources(): Sources {
	return sourcesStore.get();
}

/** What the user calls a source, ex. its log's file name or `Robot at 10.5.81.2` */
export function sourceName(source: Source): string {
	if (source.type === 'log') {
		return source.fileName;
	}
	return source.host === simulatorHost ? 'Simulator' : `Robot at ${source.host}`;
}

/** The window's live session and logs */
export function useSources(): Sources {
	return useSelector(sourcesStore);
}

/** Call `listener` when a source, its status, or which ones are visible changes */
export function subscribeSource(listener: () => void): () => void {
	const { unsubscribe } = sourcesStore.subscribe(() => listener());
	return unsubscribe;
}

/** Fraction of the loading log parsed or downloaded so far, from 0 to 1, or `undefined` when indeterminate */
export function useLogProgress(): number | undefined {
	return useSelector(logProgressStore);
}

// The time base drawn last, so the timeline only starts over when it changes
let shownTimeBase: Source | undefined;
let shownData: readonly DataSet[] = [];

/** Draw the visible sources in every dashboard and widget, call after changing the sources */
function showVisible(): void {
	const visible = visibleSources(sourcesStore.get());
	const data = visible.flatMap((source) => {
		const set = sourceData(source);
		return set ? [set] : [];
	});
	const timeBase = visible[0];
	if (data.length === shownData.length && data.every((set, index) => set === shownData[index])) {
		shownTimeBase = timeBase;
		return;
	}
	const fresh = shownData.length === 0;
	const newTimeBase =
		timeBase === undefined || shownTimeBase === undefined || sourceId(timeBase) !== sourceId(shownTimeBase);
	if (fresh) {
		showWholeSource();
	} else if (newTimeBase) {
		keepViewWidth();
	}
	shownTimeBase = timeBase;
	shownData = data;
	setVisibleData(data, timeBase?.type === 'live');
	if (fresh || newTimeBase) {
		setTimeBase(timeBase, data[0]?.offset ?? 0, fresh);
	}
}

export function updateSources(changes: Partial<Sources>): void {
	sourcesStore.set((sources) => ({ ...sources, ...changes }));
	showVisible();
}

/** Change a log, if it's still open */
export function updateLog(id: string, changes: Partial<LogSource>): void {
	updateSources({
		// oxlint-disable-next-line oxc/no-map-spread -- Sources are immutable, each change is a new object
		logs: sourcesStore.get().logs.map((log) => (log.id === id ? { ...log, ...changes } : log)),
	});
}

/** An entry of the top open log, whether or not it's visible, see `findEntry()` */
export function getLogEntry(name: string, id?: string): Entry | undefined {
	const log = id ?? sourcesStore.get().logs[0]?.id;
	const data = log === undefined ? undefined : sourceState.logData.get(log);
	return data && findEntry(data.entries, name);
}

/** Show or hide a source without closing it */
export function toggleHidden(source: Source): void {
	setHidden((other) => (sourceId(other) === sourceId(source) ? source.hidden !== true : other.hidden === true));
}

/** Show only `source`, or show every source if it's the only one shown already */
export function solo(source: Source): void {
	const id = sourceId(source);
	const list = sourceList(sourcesStore.get());
	const alone = list.every((other) => (sourceId(other) === id) !== (other.hidden === true));
	setHidden((other) => !alone && sourceId(other) !== id);
}

function setHidden(hidden: (source: Source) => boolean): void {
	const { live, logs } = sourcesStore.get();
	updateSources({
		live: live && { ...live, hidden: hidden(live) },
		// oxlint-disable-next-line oxc/no-map-spread -- Sources are immutable, each change is a new object
		logs: logs.map((log) => ({ ...log, hidden: hidden(log) })),
	});
}

/** Move a log to `index` among the logs. The live session stays first. */
export function moveLog(id: string, index: number): void {
	const { logs } = sourcesStore.get();
	const log = logs.find((other) => other.id === id);
	if (log === undefined) {
		return;
	}
	const rest = logs.filter((other) => other.id !== id);
	updateSources({ logs: rest.toSpliced(Math.max(0, Math.min(index, rest.length)), 0, log) });
}

/** Point out a source's row, ex. when the user opens a log that's already open */
export function highlightSource(id: string): void {
	highlightedSourceStore.set((current) => ({ id, count: (current?.count ?? 0) + 1 }));
}

/** Close a log, leaving the other sources as they are */
export function closeLog(id: string): void {
	sourceState.stopLog.get(id)?.();
	sourceState.stopLog.delete(id);
	sourceState.logData.delete(id);
	const { logs } = sourcesStore.get();
	updateSources({ logs: logs.filter((log) => log.id !== id) });
	if (import.meta.env.DEV && sourcesStore.get().logs.length === 0) {
		void saveDevLog(undefined);
	}
}

/** Throw away the live session's data and recording and stop connecting */
export function closeLive(): void {
	sourceState.liveGeneration++;
	sourceState.stopLive?.();
	sourceState.stopLive = undefined;
	sourceState.liveData = undefined;
	deleteLiveRecording();
	updateSources({ live: undefined });
}

/** Close a source, leaving the others as they are */
export function closeSource(source: Source): void {
	if (source.type === 'live') {
		closeLive();
	} else {
		closeLog(source.id);
	}
}
