import { toastManager } from '@/components/ui/toast';
import { findConnectTarget, findReachable, isSourceTarget } from '@/data/connect-target';
import type { DataSet } from '@/data/data-set';
import { createDataSet } from '@/data/data-store';
import { loadDevLog, saveDevLog } from '@/data/dev-log';
import type { LiveStatus } from '@/data/live-source';
import {
	isWpilog,
	loadLog,
	loadLogStream,
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
	type LiveSource,
	logProgressStore,
	show,
	showSource,
	type Source,
	sourceName,
	type Sources,
	sourcesStore,
	sourceState,
	subscribeSource,
	updateSources,
	useLogProgress,
	useSource,
	useSources,
} from '@/data/source-store';
import { simulatorHost } from '@/robot-target';
import { formatRoughDuration, formatTime } from '@/timeline/timeline';

export {
	closeLive,
	closeLog,
	closeSource,
	getLogEntry,
	getSource,
	getSources,
	type LiveSource,
	showSource,
	type Source,
	sourceName,
	type Sources,
	subscribeSource,
	useLogProgress,
	useSource,
	useSources,
};

/** Shared callbacks and source-state setup for both whole-file and streaming log loads */
function startLogLoad(options: {
	name: string;
	initialProgress: number | undefined;
	cancelable?: boolean;
	devFile?: File | false;
	onError?: (message: string) => void;
}) {
	const { name, initialProgress, cancelable, devFile = false, onError } = options;
	sourceState.logGeneration++;
	const generation = sourceState.logGeneration;
	sourceState.stopLog?.();
	const data = createDataSet();
	sourceState.logData = data;
	logProgressStore.set(initialProgress);
	updateSources({ log: { type: 'log', fileName: name, status: 'loading', cancelable } });
	show('log', true);

	let finished = false;
	const isActive = () => !finished && sourceState.logGeneration === generation;
	const callbacks = {
		onProgress: (progress: number | undefined) => {
			if (isActive()) {
				logProgressStore.set(progress);
			}
		},
		onLoaded: (unread: UnreadEnd | undefined) => {
			if (!isActive()) {
				return;
			}
			finished = true;
			updateSources({ log: { type: 'log', fileName: name, status: 'loaded', unread } });
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
			closeLog();
			toastManager.add({ type: 'error', title: `Couldn't open ${name}`, description: message });
			onError?.(message);
		},
	};
	return { data, callbacks, isActive, markFinished: () => (finished = true) };
}

/**
 * Open a WPILOG file and show it, replacing the open log. The live session keeps running in the background.
 * Nothing changes if the file isn't a WPILOG file. Returns whether the file started loading and transferred its buffer, if any.
 * `onError` gets why it couldn't be opened, which is also shown in a toast.
 */
export async function openLog(input: LogInput, onError?: (message: string) => void): Promise<boolean> {
	const { name } = input;
	const contents = input instanceof File ? input : input.contents;
	const size = contents instanceof File ? contents.size : contents.byteLength;
	const requestedAt = sourceState.logGeneration;
	if (size === 0 || !(await isWpilog(contents))) {
		// Ex. a log the robot lost power right after creating
		const message = size === 0 ? "It's empty." : "It isn't a WPILOG file.";
		toastManager.add({ type: 'error', title: `Couldn't open ${name}`, description: message });
		onError?.(message);
		return false;
	}
	if (sourceState.logGeneration !== requestedAt) {
		return false;
	}

	// Keep a copy for dev reloads before the worker takes ownership of the buffer.
	const devFile = import.meta.env.DEV && (contents instanceof File ? contents : new File([contents], name));
	const { data, callbacks } = startLogLoad({ name, initialProgress: 0, devFile, onError });
	sourceState.stopLog = loadLog(contents, data, callbacks);
	return true;
}

/**
 * Open a streaming WPILOG source (ex. a remote URL download), replacing the open log once headers and magic bytes have
 * already been validated. Returns a handle to push chunks, finish, or fail the stream.
 */
export function openLogStream(options: {
	name: string;
	totalBytes: number | undefined;
	onCancel: () => void;
	onError?: (message: string) => void;
}): Omit<LogStreamHandle, 'stop'> & { isActive: () => boolean } {
	const { name, totalBytes, onCancel, onError } = options;
	const initialProgress = totalBytes !== undefined && totalBytes > 0 ? 0 : undefined;
	const { data, callbacks, isActive, markFinished } = startLogLoad({
		name,
		initialProgress,
		cancelable: true,
		onError,
	});
	const stream = loadLogStream(data, totalBytes, callbacks);
	sourceState.stopLog = () => {
		stream.stop();
		if (isActive()) {
			markFinished();
			onCancel();
		}
	};
	return {
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
	if (file !== undefined && getSource() === undefined) {
		await openLog(file);
	}
}

/** Connect the live session to the NT4 server at `host`, adding to its data */
async function connectToHost(host: string, status: LiveStatus): Promise<void> {
	updateSources({ live: { type: 'live', host, status } });
	const requestedAt = sourceState.liveGeneration;
	const [{ connectLive }, { openNt }] = await Promise.all([import('@/data/live-source'), import('@/nt/client')]);
	const nt = await openNt(host);
	if (sourceState.liveGeneration !== requestedAt || sourceState.liveData === undefined) {
		// Replaced while loading
		nt.close();
		return;
	}
	sourceState.stopLive = connectLive(nt, sourceState.liveData, recordLive(host), (liveStatus) => {
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
	sourceState.liveGeneration++;
	sourceState.stopLive?.();
	sourceState.stopLive = undefined;
	updateSources({ live: { ...live, status: 'disconnected' } });
}

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
	const hosts = robotHost === undefined ? [simulatorHost] : [robotHost, simulatorHost];
	updateSources({ live: { type: 'live', host: hosts.join(' or '), status: 'connecting' } });
	show('live');
	// Stopped when the live session is replaced or closed
	sourceState.stopLive = findReachable(hosts, (host) => void connectToHost(host, 'connecting'));
}

/** Show a live session restored from its recording, see `@/data/restore-live`. `false` if one was started first. */
export function restoreLiveSession(data: DataSet, { host, disconnected }: RestoredLog): boolean {
	if (sourcesStore.get().live !== undefined) {
		return false;
	}
	sourceState.liveData = data;
	updateSources({ live: { type: 'live', host, status: 'disconnected' } });
	if (sourcesStore.get().shown === undefined) {
		show('live');
	}
	if (!disconnected) {
		void connectToHost(host, 'reconnecting');
	}
	return true;
}
