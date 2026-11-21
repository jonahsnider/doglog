import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
import { toastManager } from '@/components/ui/toast';
import { findConnectTarget, isReachable, isSourceTarget } from '@/data/connect-target';
import type { DataSet } from '@/data/data-set';
import { createDataSet, type Entry, setActiveData } from '@/data/data-store';
import { loadDevLog, saveDevLog } from '@/data/dev-log';
import type { LiveStatus } from '@/data/live-source';
import { loadLog, type UnreadEnd } from '@/data/log-source';
import { simulatorHost } from '@/robot-target';
import { formatRoughDuration, formatTime, resetTimeline } from '@/timeline/timeline';
import { keepViewWidth, showWholeSource } from '@/widgets/graph/view';

/** A data source. A window has at most one log and one live session, and shows one of them in every dashboard and widget. */
export type Source =
	| {
			type: 'log';
			fileName: string;
			status: 'loading' | 'loaded';
			/** The end of the file that couldn't be read, unset when it's no more than a partial last record */
			unread?: UnreadEnd;
	  }
	| { type: 'live'; host: string; status: LiveStatus };

type LogSource = Extract<Source, { type: 'log' }>;
export type LiveSource = Extract<Source, { type: 'live' }>;

/** The window's log and live session, and which one is shown */
export type Sources = { readonly log?: LogSource; readonly live?: LiveSource; readonly shown?: Source['type'] };

const sourcesStore = createAtom<Sources>({});
// Kept apart from the sources so progress updates don't rerender everything that uses them
const logProgressStore = createAtom(0);
let logData: DataSet | undefined;
let liveData: DataSet | undefined;
let stopLog: (() => void) | undefined;
let stopLive: (() => void) | undefined;
// Change every time the log or live session is replaced or stopped, so slow requests can tell they're outdated
let logGeneration = 0;
let liveGeneration = 0;

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

/** Fraction of the loading log parsed so far, from 0 to 1 */
export function useLogProgress(): number {
	return useSelector(logProgressStore);
}

function updateSources(changes: Partial<Sources>): void {
	sourcesStore.set((sources) => ({ ...sources, ...changes }));
}

/** Show the log or live session in every dashboard and widget. A new log shows all of itself in graphs. */
function show(type: Source['type'] | undefined, newLog = false): void {
	if (newLog) {
		showWholeSource();
	} else {
		keepViewWidth();
	}
	const sources = { ...sourcesStore.get(), shown: type };
	resetTimeline(shownSource(sources));
	sourcesStore.set(sources);
	setActiveData(type === 'log' ? logData : type === 'live' ? liveData : undefined);
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
	return logData?.entries.get(name);
}

/** Close the log, showing the live session if there is one */
export function closeLog(): void {
	logGeneration++;
	stopLog?.();
	stopLog = undefined;
	logData = undefined;
	const { shown, live } = sourcesStore.get();
	updateSources({ log: undefined });
	if (shown === 'log') {
		show(live && 'live');
	}
	if (import.meta.env.DEV) {
		void saveDevLog(undefined);
	}
}

/** Throw away the live session's data and stop connecting, showing the log if there is one */
export function closeLive(): void {
	liveGeneration++;
	stopLive?.();
	stopLive = undefined;
	liveData = undefined;
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

async function isWpilog(file: File): Promise<boolean> {
	return (await file.slice(0, 6).text()) === 'WPILOG';
}

/**
 * Open a WPILOG file and show it, replacing the open log. The live session keeps running in the background.
 * Nothing changes if the file isn't a WPILOG file. Returns whether the file started loading.
 * `onError` gets why it couldn't be opened, which is also shown in a toast.
 */
export async function openLog(file: File, onError?: (message: string) => void): Promise<boolean> {
	const requestedAt = logGeneration;
	if (file.size === 0 || !(await isWpilog(file))) {
		// Ex. a log the robot lost power right after creating
		const message = file.size === 0 ? "It's empty." : "It isn't a WPILOG file.";
		toastManager.add({ type: 'error', title: `Couldn't open ${file.name}`, description: message });
		onError?.(message);
		return false;
	}
	if (logGeneration !== requestedAt) {
		// Another log was chosen while the file was being checked
		return false;
	}

	logGeneration++;
	stopLog?.();
	const data = createDataSet();
	logData = data;
	logProgressStore.set(0);
	updateSources({ log: { type: 'log', fileName: file.name, status: 'loading' } });
	show('log', true);
	stopLog = loadLog(file, data, {
		onProgress: (progress) => logProgressStore.set(progress),
		onLoaded: (unread) => {
			updateSources({ log: { type: 'log', fileName: file.name, status: 'loaded', unread } });
			if (import.meta.env.DEV) {
				void saveDevLog(file);
			}
			if (unread !== undefined) {
				toastManager.add({
					type: 'warning',
					title: 'Log corrupted',
					description: `The last ${unread.percent}% of the file is unreadable, an estimated ${formatRoughDuration(unread.duration)} after ${formatTime(unread.after, 0)}.`,
				});
			}
		},
		onError: (message) => {
			closeLog();
			toastManager.add({ type: 'error', title: `Couldn't open ${file.name}`, description: message });
			onError?.(message);
		},
	});
	return true;
}

/** Open the log from the `log` search parameter, or reopen the one that was open before the page reloaded. Only call this in dev. */
export async function reopenDevLog(): Promise<void> {
	const file = await loadDevLog();
	// Keep a source chosen while loading, ex. the log the desktop app was launched with
	if (file !== undefined && getSource() === undefined) {
		await openLog(file);
	}
}

/** Connect the live session to the NT4 server at `host`, adding to its data */
async function connectToHost(host: string, status: LiveStatus): Promise<void> {
	updateSources({ live: { type: 'live', host, status } });
	const requestedAt = liveGeneration;
	const [{ connectLive }, { openNt }] = await Promise.all([import('@/data/live-source'), import('@/nt/client')]);
	const nt = await openNt(host);
	if (liveGeneration !== requestedAt || liveData === undefined) {
		// Replaced while loading
		nt.close();
		return;
	}
	stopLive = connectLive(nt, liveData, (liveStatus) => {
		updateSources({ live: { type: 'live', host, status: liveStatus } });
	});
}

/** Stop reconnecting the live session, keeping its data. A session that never connected is closed, since it has no data. */
export function disconnect(): void {
	const { live } = sourcesStore.get();
	if (live === undefined || live.status === 'disconnected') {
		return;
	}
	if (live.status === 'connecting') {
		closeLive();
		return;
	}
	liveGeneration++;
	stopLive?.();
	stopLive = undefined;
	updateSources({ live: { ...live, status: 'disconnected' } });
}

const retryDelay = 1000;

/**
 * Show the live session, connecting to the robot at `robotHost` if it's reachable, otherwise to the simulator.
 * Keeps trying both until one is reachable, only tries the simulator without a robot host.
 * A live session is kept, and reconnected if it was disconnected, unless this would connect to another target that's reachable.
 */
export async function connect(robotHost: string | undefined): Promise<void> {
	const { live, shown } = sourcesStore.get();
	if (live !== undefined && shown !== 'live') {
		show('live');
		if (live.status !== 'disconnected') {
			return;
		}
	}
	if (live !== undefined && live.status !== 'connecting') {
		const target = await findConnectTarget(robotHost);
		// Also skipped when the session changed while checking, ex. it reconnected
		if (sourcesStore.get().live !== live) {
			return;
		}
		if (isSourceTarget(live, target)) {
			if (live.status === 'disconnected') {
				liveGeneration++;
				void connectToHost(live.host, 'reconnecting');
			}
			return;
		}
	}

	liveGeneration++;
	stopLive?.();
	stopLive = undefined;
	liveData = createDataSet();
	const hosts = robotHost === undefined ? [simulatorHost] : [robotHost, simulatorHost];
	updateSources({ live: { type: 'live', host: hosts.join(' or '), status: 'connecting' } });
	show('live');
	const requestedAt = liveGeneration;
	let retryTimer: ReturnType<typeof setTimeout> | undefined;
	stopLive = () => clearTimeout(retryTimer);

	const attempt = async () => {
		const reachable = await Promise.all(hosts.map((host) => isReachable(host)));
		if (liveGeneration !== requestedAt) {
			// The live session was replaced or closed while checking
			return;
		}

		// Hosts are in order of preference
		const host = hosts.find((_, index) => reachable[index] === true);
		if (host === undefined) {
			retryTimer = setTimeout(() => void attempt(), retryDelay);
		} else {
			void connectToHost(host, 'connecting');
		}
	};
	void attempt();
}
