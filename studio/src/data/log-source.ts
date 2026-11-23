import type { DataSet } from '@/data/data-set';
import { parseMetadata } from '@/data/data-store';
import type { LogWorkerMessage, LogWorkerRequest, RestoredLog } from '@/data/log-worker';
import { Samples } from '@/data/samples';
import { isXz } from '@/data/xz';

export type LogInput = File | { name: string; contents: ArrayBuffer };

/** Whether the first 6 bytes start a WPILOG or XZ-compressed WPILOG file */
export function hasWpilogMagic(header: Uint8Array): boolean {
	if (header.byteLength < 6) {
		return false;
	}
	return new TextDecoder().decode(header.subarray(0, 6)) === 'WPILOG' || isXz(header);
}

/** Whether a file is a WPILOG file, or an XZ-compressed one (`.wpilogxz`) */
export async function isWpilog(contents: File | ArrayBuffer): Promise<boolean> {
	const header = new Uint8Array(
		contents instanceof File ? await contents.slice(0, 6).arrayBuffer() : contents.slice(0, 6),
	);
	return hasWpilogMagic(header);
}

/** The end of a log's file that couldn't be read */
export type UnreadEnd = {
	/** Percent of the file */
	percent: number;
	/** About how long it would have lasted (µs), at the rate the rest was logged */
	duration: number;
	/** When the readable part ends (µs since the log's start) */
	after: number;
};

type LoadLogCallbacks = {
	/** Called with the fraction parsed/downloaded from 0 to 1, or `undefined` when indeterminate */
	onProgress: (progress: number | undefined) => void;
	/**
	 * `unread` is unset when the whole log was read, or all but a partial last record. `restored` is the live session a
	 * recording loaded with `live` recorded.
	 */
	onLoaded: (unread: UnreadEnd | undefined, restored: RestoredLog | undefined) => void;
	onError: (message: string) => void;
};

export type LogStreamHandle = {
	push: (chunk: ArrayBuffer, downloadedBytes: number) => void;
	finish: () => void;
	fail: (message: string) => void;
	stop: () => void;
};

function attachLogWorker(
	data: DataSet,
	{ onProgress, onLoaded, onError }: LoadLogCallbacks,
): { worker: Worker; stop: () => void } {
	const worker = new Worker(new URL('./log-worker.ts', import.meta.url), { type: 'module' });
	let stopped = false;

	const stop = () => {
		stopped = true;
		worker.terminate();
	};

	worker.addEventListener('message', (event: MessageEvent<LogWorkerMessage>) => {
		if (stopped) {
			return;
		}

		const message = event.data;
		switch (message.type) {
			case 'progress':
				onProgress(message.progress);
				break;
			case 'schemas':
				for (const [name, fields] of message.structSchemas) {
					data.addStructSchema(name, fields);
				}
				break;
			case 'entry':
				data.addEntry(
					message.name,
					message.entryType,
					new Samples(message.timestamps, message.values),
					parseMetadata(message.metadata),
				);
				break;
			case 'done': {
				stop();
				let unread: UnreadEnd | undefined;
				if (message.start !== undefined && message.end !== undefined) {
					data.setStartTime(message.start);
					data.extendTimeRange(message.start, message.end);
					data.gaps.push(...message.gaps);
					// A partial last record is normal when the robot is turned off, and a little damage only loses about a second at the end
					if (message.unreadBytes > 64 * 1024) {
						const { size } = message;
						const after = message.end - message.start;
						unread = {
							percent: Math.ceil((message.unreadBytes / size) * 100),
							duration: (message.unreadBytes / (size - message.unreadBytes)) * after,
							after,
						};
					}
				}
				onLoaded(unread, message.restored);
				break;
			}
			case 'error':
				stop();
				onError(message.message);
				break;
		}
	});

	worker.addEventListener('error', (event) => {
		if (!stopped) {
			stop();
			onError(event.message);
		}
	});

	return { worker, stop };
}

/**
 * Parse a WPILOG file in a worker and add its entries to `data`. With `live`, a live session's recording is added on
 * Studio's clock, like the live session showed it. Transfers ownership of a buffer and returns a function that cancels loading.
 */
export function loadLog(
	contents: File | ArrayBuffer,
	data: DataSet,
	callbacks: LoadLogCallbacks,
	live = false,
): () => void {
	const { worker, stop } = attachLogWorker(data, callbacks);
	worker.postMessage(
		{ kind: 'buffer', contents, live } satisfies LogWorkerRequest,
		contents instanceof ArrayBuffer ? [contents] : [],
	);
	return stop;
}

/** Parse a WPILOG stream in a worker as chunks arrive, transferring each chunk zero-copy */
export function loadLogStream(
	data: DataSet,
	totalBytes: number | undefined,
	callbacks: LoadLogCallbacks,
): LogStreamHandle {
	const { worker, stop } = attachLogWorker(data, callbacks);
	worker.postMessage({ kind: 'stream-start', totalBytes } satisfies LogWorkerRequest, []);
	return {
		push: (chunk, downloadedBytes) => {
			worker.postMessage({ kind: 'stream-chunk', chunk, downloadedBytes } satisfies LogWorkerRequest, [chunk]);
		},
		finish: () => {
			worker.postMessage({ kind: 'stream-end' } satisfies LogWorkerRequest, []);
		},
		fail: (message) => {
			worker.postMessage({ kind: 'stream-error', message } satisfies LogWorkerRequest, []);
		},
		stop,
	};
}
