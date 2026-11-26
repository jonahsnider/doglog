// Live sessions are recorded to WPILOG files in the origin private file system, one per session, so they can be
// exported and restored after Studio closes. See `@/data/recorder` for what's written.
import { toastManager } from '@/components/toast';
import type { RestoredLog } from '@/data/log-worker';
import type { RecordingEvent } from '@/data/recorder';
import type { RecordingWorkerMessage, RecordingWorkerRequest } from '@/data/recording-worker';
import { createId } from '@/lib/random-id';

const folderName = 'live-recordings';
// Held while choosing a recording to restore, so two windows don't choose the same one
const claimLock = 'doglog-studio:live-recordings';

/** Held by the tab or window using a recording until it closes */
function recordingLock(id: string): string {
	return `doglog-studio:live-recording-${id}`;
}

function fileName(id: string): string {
	return `${id}.wpilog`;
}

async function getFolder(): Promise<FileSystemDirectoryHandle> {
	return (await navigator.storage.getDirectory()).getDirectoryHandle(folderName, { create: true });
}

/** Hold a Web Lock until the returned function is called, `undefined` if another tab or window holds it */
function holdLock(name: string): Promise<(() => void) | undefined> {
	return new Promise((resolve) => {
		void navigator.locks.request(name, { ifAvailable: true }, (lock) => {
			if (lock === null) {
				resolve(undefined);
				return undefined;
			}
			// Held until it resolves
			return new Promise<void>((_resolve) => {
				resolve(_resolve);
			});
		});
	});
}

/** The recording of a live session, written as it receives data */
export class LiveRecording {
	private readonly id: string;
	private readonly host: string;
	private readonly release: Promise<(() => void) | undefined>;
	private readonly restored: RestoredLog | undefined;
	private worker: Worker | undefined;
	private events: RecordingEvent[] = [];
	private readonly reads = new Map<number, { resolve: (file: Blob) => void; reject: (error: Error) => void }>();
	private nextRead = 0;
	private deleted = false;
	/** When the session first connected, on Studio's clock */
	startedAt: number | undefined;

	private constructor(id: string, host: string, release: Promise<(() => void) | undefined>, restored?: RestoredLog) {
		this.id = id;
		this.host = host;
		this.release = release;
		this.restored = restored;
		this.startedAt = restored?.start;
		if (restored) {
			this.start();
		}
	}

	/** Record a new live session. Its file is created once it connects. */
	static create(host: string): LiveRecording {
		const id = createId();
		return new LiveRecording(id, host, holdLock(recordingLock(id)));
	}

	/** Whether the session connected, so there's a recording to export */
	get started(): boolean {
		return this.worker !== undefined;
	}

	record(event: RecordingEvent): void {
		if (this.deleted || (this.worker === undefined && event.type !== 'connected')) {
			return;
		}
		if (event.type === 'connected') {
			this.startedAt ??= event.liveTime;
		}
		this.start();
		// Sent in batches, one message for each value would flood the worker
		if (this.events.length === 0) {
			queueMicrotask(() => {
				this.send({ type: 'events', events: this.events });
				this.events = [];
			});
		}
		this.events.push(event);
	}

	/** Everything recorded so far */
	read(): Promise<Blob> {
		if (this.worker === undefined || this.deleted) {
			return Promise.reject(new Error('Nothing was recorded.'));
		}
		const request = this.nextRead++;
		// After the events waiting to be sent
		queueMicrotask(() => this.send({ type: 'read', request }));
		return new Promise((resolve, reject) => {
			this.reads.set(request, { resolve, reject });
		});
	}

	delete(): void {
		if (this.deleted) {
			return;
		}
		this.deleted = true;
		for (const { reject } of this.reads.values()) {
			reject(new Error('The live session was cleared.'));
		}
		this.reads.clear();
		if (this.worker) {
			this.send({ type: 'delete' });
		} else {
			this.stop();
		}
	}

	/**
	 * Stop writing, keeping the file for another window to continue, see `claimRecording()`. Returns its ID, `undefined`
	 * if nothing was recorded.
	 */
	async close(): Promise<string | undefined> {
		if (this.deleted) {
			return undefined;
		}
		this.deleted = true;
		if (this.worker === undefined) {
			this.stop();
			return undefined;
		}
		// Once everything sent before it is written
		const request = this.nextRead++;
		const written = new Promise<unknown>((resolve) => {
			this.reads.set(request, { resolve, reject: resolve });
		});
		queueMicrotask(() => this.send({ type: 'read', request }));
		await written;
		this.stop();
		return this.id;
	}

	private start(): void {
		if (this.worker) {
			return;
		}
		this.worker = new Worker(new URL('./recording-worker.ts', import.meta.url), { type: 'module' });
		this.worker.addEventListener('message', ({ data }: MessageEvent<RecordingWorkerMessage>) => this.handle(data));
		this.send({ type: 'open', folder: folderName, name: fileName(this.id), host: this.host, restored: this.restored });
	}

	private send(request: RecordingWorkerRequest): void {
		this.worker?.postMessage(request);
	}

	private handle(message: RecordingWorkerMessage): void {
		switch (message.type) {
			case 'failed':
				toastManager.add({ type: 'warning', title: 'Stopped recording live data', description: message.message });
				break;
			case 'read': {
				const read = this.reads.get(message.request);
				this.reads.delete(message.request);
				if ('file' in message) {
					read?.resolve(message.file);
				} else {
					read?.reject(new Error(message.error));
				}
				break;
			}
			case 'deleted':
				this.stop();
				if (message.error !== undefined) {
					reportDeleteError(message.error);
				}
				break;
		}
	}

	private stop(): void {
		this.worker?.terminate();
		void this.release.then((release) => release?.());
	}

	/** Continue a recording that was restored */
	static restore(id: string, release: () => void, restored: RestoredLog): LiveRecording {
		return new LiveRecording(id, restored.host, Promise.resolve(release), restored);
	}
}

// The recording of this tab or window's live session
let liveRecording: LiveRecording | undefined;

/** The live session's recording, `undefined` if there's no live session */
export function getLiveRecording(): LiveRecording | undefined {
	return liveRecording;
}

/** The live session's recording, which is started for `host` if there's none */
export function recordLive(host: string): LiveRecording {
	liveRecording ??= LiveRecording.create(host);
	return liveRecording;
}

/** Stop recording the live session, keeping its file for another window, see `LiveRecording.close()` */
export function closeLiveRecording(): Promise<string | undefined> {
	const recording = liveRecording;
	liveRecording = undefined;
	return recording?.close() ?? Promise.resolve(undefined);
}

/** Delete the live session's recording, ex. when it's cleared */
export function deleteLiveRecording(): void {
	liveRecording?.delete();
	liveRecording = undefined;
}

async function deleteRecordingFile(id: string): Promise<void> {
	const folder = await getFolder();
	try {
		await folder.removeEntry(fileName(id));
	} catch (error) {
		if (!(error instanceof DOMException && error.name === 'NotFoundError')) {
			throw error;
		}
	}
}

function reportDeleteError(error: unknown): void {
	toastManager.add({ type: 'error', title: "Couldn't delete live recording", description: String(error) });
}

/** A recording this tab or window chose to restore, which no other tab or window can use until it's released */
export type ClaimedRecording = {
	file: File;
	/** Continue writing it as the live session's recording, see `toLiveTimes()` */
	continue(restored: RestoredLog): LiveRecording;
	/** Delete it, ex. when it can't be read */
	delete(): void;
	/** Leave it for another tab or window, or this one to restore later */
	release(): void;
};

/**
 * Claim the recording that changed most recently that no other tab or window uses, to restore it, or the one with `only`
 * as its ID, ex. a live session another window moved here
 */
export function claimRecording(only?: string): Promise<ClaimedRecording | undefined> {
	return navigator.locks.request(claimLock, async () => {
		let newest: { id: string; file: File; release: () => void } | undefined;
		for await (const handle of (await getFolder()).values()) {
			if (handle.kind !== 'file' || !handle.name.endsWith('.wpilog')) {
				continue;
			}
			const id = handle.name.slice(0, -'.wpilog'.length);
			if (only !== undefined && id !== only) {
				continue;
			}
			const release = await holdLock(recordingLock(id));
			if (!release) {
				continue;
			}
			const file = await handle.getFile();
			if (newest === undefined || file.lastModified > newest.file.lastModified) {
				newest?.release();
				newest = { id, file, release };
			} else {
				release();
			}
		}
		if (!newest) {
			return undefined;
		}
		const { id, file, release } = newest;
		return {
			file,
			continue: (restored) => {
				liveRecording?.delete();
				liveRecording = LiveRecording.restore(id, release, restored);
				return liveRecording;
			},
			delete: () => void deleteRecordingFile(id).catch(reportDeleteError).finally(release),
			release,
		};
	});
}
