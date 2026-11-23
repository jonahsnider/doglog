import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
import type { DataSet } from '@/data/data-set';
import { type Entry, setActiveData } from '@/data/data-store';
import { saveDevLog } from '@/data/dev-log';
import type { LiveStatus } from '@/data/live-source';
import type { UnreadEnd } from '@/data/log-source';
import { deleteLiveRecording } from '@/data/recording';
import { simulatorHost } from '@/robot-target';
import { resetTimeline } from '@/timeline/timeline';
import { keepViewWidth, showWholeSource } from '@/widgets/graph/view';

/** A data source. A window has at most one log and one live session, and shows one of them in every dashboard and widget. */
export type Source =
	| {
			type: 'log';
			fileName: string;
			status: 'loading' | 'loaded';
			/** Whether the in-progress load can be canceled by the user (ex. a network download) */
			cancelable?: boolean;
			/** The end of the file that couldn't be read, unset when it's no more than a partial last record */
			unread?: UnreadEnd;
	  }
	| { type: 'live'; host: string; status: LiveStatus };

type LogSource = Extract<Source, { type: 'log' }>;
export type LiveSource = Extract<Source, { type: 'live' }>;

/** The window's log and live session, and which one is shown */
export type Sources = { readonly log?: LogSource; readonly live?: LiveSource; readonly shown?: Source['type'] };

export const sourcesStore = createAtom<Sources>({});
// Kept apart from the sources so progress updates don't rerender everything that uses them
export const logProgressStore = createAtom<number | undefined>(0);

export const sourceState: {
	logData: DataSet | undefined;
	liveData: DataSet | undefined;
	stopLog: (() => void) | undefined;
	stopLive: (() => void) | undefined;
	// Change every time the log or live session is replaced or stopped, so slow requests can tell they're outdated
	logGeneration: number;
	liveGeneration: number;
} = {
	logData: undefined,
	liveData: undefined,
	stopLog: undefined,
	stopLive: undefined,
	logGeneration: 0,
	liveGeneration: 0,
};

function shownSource({ log, live, shown }: Sources): Source | undefined {
	return shown === 'log' ? log : shown === 'live' ? live : undefined;
}

/** The source every dashboard and widget shows */
export function useSource(): Source | undefined {
	return useSelector(sourcesStore, shownSource);
}

/** The source every dashboard and widget shows */
export function getSource(): Source | undefined {
	return shownSource(sourcesStore.get());
}

/** Both the log and live session currently held by this window */
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

/** The window's log and live session, including the one that isn't shown */
export function useSources(): Sources {
	return useSelector(sourcesStore);
}

/** Call `listener` when a source, its status, or which one is shown changes */
export function subscribeSource(listener: () => void): () => void {
	const { unsubscribe } = sourcesStore.subscribe(() => listener());
	return unsubscribe;
}

/** Fraction of the loading log parsed or downloaded so far, from 0 to 1, or `undefined` when indeterminate */
export function useLogProgress(): number | undefined {
	return useSelector(logProgressStore);
}

export function updateSources(changes: Partial<Sources>): void {
	sourcesStore.set((sources) => ({ ...sources, ...changes }));
}

/** Show the log or live session in every dashboard and widget. A new log shows all of itself in graphs. */
export function show(type: Source['type'] | undefined, newLog = false): void {
	if (newLog) {
		showWholeSource();
	} else {
		keepViewWidth();
	}
	const sources = { ...sourcesStore.get(), shown: type };
	resetTimeline(shownSource(sources));
	sourcesStore.set(sources);
	setActiveData(type === 'log' ? sourceState.logData : type === 'live' ? sourceState.liveData : undefined);
}

/** Switch to the log or the live session, if it's open and not already shown */
export function showSource(type: Source['type']): void {
	const sources = sourcesStore.get();
	if (sources[type] !== undefined && sources.shown !== type) {
		show(type);
	}
}

/** An entry of the open log, whether or not it's shown */
export function getLogEntry(name: string): Entry | undefined {
	return sourceState.logData?.entries.get(name);
}

/** Close the log, showing the live session if there is one */
export function closeLog(): void {
	sourceState.logGeneration++;
	sourceState.stopLog?.();
	sourceState.stopLog = undefined;
	sourceState.logData = undefined;
	const { shown, live } = sourcesStore.get();
	updateSources({ log: undefined });
	if (shown === 'log') {
		show(live && 'live');
	}
	if (import.meta.env.DEV) {
		void saveDevLog(undefined);
	}
}

/** Throw away the live session's data and recording and stop connecting, showing the log if there is one */
export function closeLive(): void {
	sourceState.liveGeneration++;
	sourceState.stopLive?.();
	sourceState.stopLive = undefined;
	sourceState.liveData = undefined;
	deleteLiveRecording();
	const { shown, log } = sourcesStore.get();
	updateSources({ live: undefined });
	if (shown === 'live') {
		show(log && 'log');
	}
}

/** Close the shown source, showing the other one if there is one */
export function closeSource(): void {
	const { shown } = sourcesStore.get();
	if (shown !== undefined) {
		(shown === 'log' ? closeLog : closeLive)();
	}
}
