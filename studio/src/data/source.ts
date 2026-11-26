// oxlint-disable max-lines -- Opening logs and connecting the live session share the source state they set up
import { toastManager } from '@/components/toast';
import { findConnectTarget, findReachable, isSourceTarget } from '@/data/connect-target';
import type { DataSet } from '@/data/data-set';
import { createDataSet, flushData } from '@/data/data-store';
import { loadDevLog, saveDevLog } from '@/data/dev-log';
import type { LiveStatus } from '@/data/live-source';
import {
	isWpilog,
	loadLog,
	loadLogStream,
	logFileExtension,
	type LogInput,
	type LogStreamHandle,
	type UnreadEnd,
} from '@/data/log-source';
import type { RestoredLog } from '@/data/log-worker';
import { deleteLiveRecording, recordLive } from '@/data/recording';
import {
	closeLive,
	closeLog,
	closeSource,
	getLogEntry,
	getSource,
	getSources,
	highlightSource,
	type LiveSource,
	type LogSource,
	logProgressStore,
	moveLog,
	solo,
	type Source,
	sourceId,
	sourceList,
	sourceName,
	type Sources,
	sourcesStore,
	sourceState,
	subscribeSource,
	toggleHidden,
	updateLog,
	updateSources,
	useLogProgress,
	useSource,
	useSources,
	visibleSources,
} from '@/data/source-store';
import { lineUpLog, setLiveLineUp, watchLiveLineUp } from '@/data/source-line-up';
import { createId } from '@/lib/random-id';
import { simulatorHost } from '@/robot-target';
import { formatRoughDuration, formatTime, goLive } from '@/timeline/timeline';

export {
	closeLive,
	closeLog,
	closeSource,
	getLogEntry,
	getSource,
	getSources,
	type LiveSource,
	type LogSource,
	moveLog,
	solo,
	type Source,
	sourceId,
	sourceList,
	sourceName,
	type Sources,
	subscribeSource,
	toggleHidden,
	useLogProgress,
	useSource,
	useSources,
	visibleSources,
};

/** Ignores a stream's chunks, see `openLogStream()` */
const ignore = () => {};

/** The log loading most recently, whose progress the timeline shows */
let progressLog: string | undefined;

/** Shared callbacks and source-state setup for both whole-file and streaming log loads */
function startLogLoad(options: {
	name: string;
	initialProgress: number | undefined;
	cancelable?: boolean;
	devFile?: File | false;
	onError?: (message: string) => void;
}) {
	const { name, initialProgress, cancelable, devFile = false, onError } = options;
	const id = createId();
	const data = createDataSet();
	sourceState.logData.set(id, data);
	progressLog = id;
	logProgressStore.set(initialProgress);
	const log: LogSource = { type: 'log', id, fileName: name, status: 'loading', cancelable };
	updateSources({ logs: [...sourcesStore.get().logs, log] });

	let finished = false;
	const isActive = () => !finished && sourceState.logData.get(id) === data;
	const callbacks = {
		onProgress: (progress: number | undefined) => {
			if (isActive() && progressLog === id) {
				logProgressStore.set(progress);
			}
		},
		onLoaded: (unread: UnreadEnd | undefined) => {
			if (!isActive()) {
				return;
			}
			finished = true;
			flushData();
			data.publish();
			lineUpLog(id);
			updateLog(id, { status: 'loaded', cancelable: undefined, unread });
			if (devFile !== false) {
				void saveDevLog(devFile);
			}
			if (unread !== undefined) {
				toastManager.add({
					type: 'warning',
					title: 'Log corrupted',
					description: `The last ${unread.percent}% of the file is unreadable, an estimated ${formatRoughDuration(unread.duration)} after ${formatTime(unread.after, 0)}.`,
				});
			}
		},
		onError: (message: string) => {
			if (!isActive()) {
				return;
			}
			finished = true;
			closeLog(id);
			toastManager.add({ type: 'error', title: `Couldn't open ${name}`, description: message });
			onError?.(message);
		},
	};
	return { id, data, callbacks, isActive, markFinished: () => (finished = true) };
}

/** The open log with this file name, so opening it again points it out instead of reading it again */
function openLogNamed(name: string): LogSource | undefined {
	return sourcesStore.get().logs.find((log) => log.fileName === name);
}

/**
 * Open a local log and add it to the window's sources. Returns whether the file started loading and transferred its
 * buffer, if any, or was already open. `onError` gets why it couldn't be opened, which is also shown in a toast.
 */
export async function openLog(input: LogInput, onError?: (message: string) => void): Promise<boolean> {
	const { name } = input;
	const open = openLogNamed(name);
	if (open !== undefined) {
		highlightSource(open.id);
		return true;
	}
	const contents = input instanceof File ? input : input.contents;
	const size = contents instanceof File ? contents.size : contents.byteLength;
	const wpilog = size > 0 && (await isWpilog(contents));
	const hoot = logFileExtension.exec(name)?.[1]?.toLowerCase() === 'hoot';
	if (size === 0 || (!wpilog && !hoot)) {
		// Ex. a log the robot lost power right after creating
		const message = size === 0 ? "It's empty." : "It isn't a WPILOG or HOOT file.";
		toastManager.add({ type: 'error', title: `Couldn't open ${name}`, description: message });
		onError?.(message);
		return false;
	}
	// Opened again while checking it
	const opened = openLogNamed(name);
	if (opened !== undefined) {
		highlightSource(opened.id);
		return true;
	}

	// Keep a copy for dev reloads before the worker takes ownership of the buffer.
	const devFile = import.meta.env.DEV && (contents instanceof File ? contents : new File([contents], name));
	const { id, data, callbacks } = startLogLoad({ name, initialProgress: 0, devFile, onError });
	sourceState.stopLog.set(id, loadLog(contents, data, callbacks, { format: wpilog ? 'wpilog' : 'hoot' }));
	return true;
}

/**
 * Open a streaming WPILOG source (ex. a remote URL download), adding it to the window's sources once headers and magic
 * bytes have already been validated. Returns a handle to push chunks, finish, or fail the stream.
 */
export function openLogStream(options: {
	name: string;
	totalBytes: number | undefined;
	onCancel: () => void;
	onError?: (message: string) => void;
}): Omit<LogStreamHandle, 'stop'> & { id: string; isActive: () => boolean } {
	const { name, totalBytes, onCancel, onError } = options;
	const open = openLogNamed(name);
	if (open !== undefined) {
		// Already downloaded, point it out instead
		highlightSource(open.id);
		onCancel();
		return { id: open.id, isActive: () => false, push: ignore, finish: ignore, fail: ignore };
	}
	const initialProgress = totalBytes !== undefined && totalBytes > 0 ? 0 : undefined;
	const { id, data, callbacks, isActive, markFinished } = startLogLoad({
		name,
		initialProgress,
		cancelable: true,
		onError,
	});
	const stream = loadLogStream(data, totalBytes, callbacks);
	sourceState.stopLog.set(id, () => {
		stream.stop();
		if (isActive()) {
			markFinished();
			onCancel();
		}
	});
	return {
		id,
		isActive,
		push: (chunk, downloadedBytes) => {
			if (isActive()) {
				stream.push(chunk, downloadedBytes);
			}
		},
		finish: () => {
			if (isActive()) {
				stream.finish();
			}
		},
		fail: (message) => {
			if (isActive()) {
				stream.fail(message);
			}
		},
	};
}

/** Open the log from the `log` search parameter, or reopen the one that was open before the page reloaded. Only call this in dev. */
export async function reopenDevLog(): Promise<void> {
	const file = await loadDevLog();
	// Keep a source chosen while loading, ex. the log the desktop app was launched with
	if (file !== undefined && sourcesStore.get().logs.length === 0) {
		await openLog(file);
	}
}

/** Connect the live session to the NT4 server at `host`, adding to its data */
/** Update the live session's host and status, keeping whether it's hidden */
function setLive(host: string, status: LiveStatus): void {
	updateSources({ live: { ...sourcesStore.get().live, type: 'live', host, status } });
}

export async function connectToHost(host: string, status: LiveStatus): Promise<void> {
	setLive(host, status);
	const requestedAt = sourceState.liveGeneration;
	const [{ connectLive }, { openNt }] = await Promise.all([import('@/data/live-source'), import('@/nt/client')]);
	const nt = await openNt(host);
	if (sourceState.liveGeneration !== requestedAt || sourceState.liveData === undefined) {
		// Replaced while loading
		nt.close();
		return;
	}
	sourceState.stopLive = connectLive(nt, sourceState.liveData, recordLive(host), (liveStatus) => {
		setLive(host, liveStatus);
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
	sourceState.liveGeneration++;
	sourceState.stopLive?.();
	sourceState.stopLive = undefined;
	setLive(live.host, 'disconnected');
}

/**
 * Connect the live session to the robot at `robotHost` if it's reachable, otherwise to the simulator.
 * Keeps trying both until one is reachable, only tries the simulator without a robot host.
 * A live session is kept, and reconnected if it was disconnected, unless this would connect to another target that's reachable.
 */
export async function connect(robotHost: string | undefined): Promise<void> {
	const { live } = sourcesStore.get();
	if (live !== undefined && live.status !== 'connecting') {
		const target = await findConnectTarget(robotHost);
		// Also skipped when the session changed while checking, ex. it reconnected
		if (sourcesStore.get().live !== live) {
			return;
		}
		if (isSourceTarget(live, target)) {
			if (live.status === 'disconnected') {
				sourceState.liveGeneration++;
				void connectToHost(live.host, 'reconnecting');
			}
			return;
		}
	}

	sourceState.liveGeneration++;
	sourceState.stopLive?.();
	sourceState.stopLive = undefined;
	deleteLiveRecording();
	sourceState.liveData = createDataSet();
	setLiveLineUp('data');
	const hosts = robotHost === undefined ? [simulatorHost] : [robotHost, simulatorHost];
	updateSources({ live: { type: 'live', host: hosts.join(' or '), status: 'connecting' } });
	goLive();
	// Stopped when the live session is replaced or closed
	sourceState.stopLive = findReachable(hosts, (host) => void connectToHost(host, 'connecting'));
}

/** Add a live session restored from its recording, see `@/data/restore-live`. `false` if one was started first. */
export function restoreLiveSession(data: DataSet, { host, disconnected }: RestoredLog): boolean {
	if (sourcesStore.get().live !== undefined) {
		return false;
	}
	sourceState.liveData = data;
	setLiveLineUp('data');
	updateSources({ live: { type: 'live', host, status: 'disconnected' } });
	watchLiveLineUp();
	if (!disconnected) {
		void connectToHost(host, 'reconnecting');
	}
	return true;
}
