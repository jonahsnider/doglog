// Writes a live session's recording to the origin private file system off the main thread, see `@/data/recording`
import { DataLogWriter } from 'wpilog-parser';
import type { RestoredLog } from '@/data/log-worker';
import { finishRecords, Recorder, type RecordingEvent } from '@/data/recorder';

/** Sent by `recording.ts`, in order. `open` comes first. */
export type RecordingWorkerRequest =
	| { type: 'open'; folder: string; name: string; host: string; restored: RestoredLog | undefined }
	| { type: 'events'; events: RecordingEvent[] }
	| { type: 'read'; request: number }
	| { type: 'delete' };

export type RecordingWorkerMessage =
	/** Recording stopped, the file keeps what was written before */
	| { type: 'failed'; message: string }
	| { type: 'read'; request: number; file: Blob }
	| { type: 'read'; request: number; error: string }
	| { type: 'deleted' };

/** A WPILOG header without extra text */
const headerLength = 12;
/** Most data lost when Studio crashes or loses power */
const flushInterval = 1000;
const readChunkLength = 16 * 1024 * 1024;

let folder: FileSystemDirectoryHandle | undefined;
let fileName = '';
let file: FileSystemSyncAccessHandle | undefined;
let writer: DataLogWriter | undefined;
let recorder: Recorder | undefined;
let position = 0;
let failed = false;

function message(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function fail(error: unknown): void {
	if (!failed) {
		failed = true;
		writer?.close();
		postMessage({ type: 'failed', message: message(error) } satisfies RecordingWorkerMessage);
	}
}

function write(bytes: Uint8Array): void {
	if (failed || !file) {
		return;
	}
	try {
		position += file.write(bytes, { at: position });
	} catch (error) {
		// Ex. storage is full
		fail(error);
	}
}

/** Write records to the file as they're added. A recording that's continued already has the header. */
async function drain(readable: ReadableStream<Uint8Array>, continued: boolean): Promise<void> {
	const reader = readable.getReader();
	let header = continued;
	for (;;) {
		// oxlint-disable-next-line no-await-in-loop -- Each read waits for the next records
		const { done, value } = await reader.read();
		if (done) {
			return;
		}
		write(header ? value.subarray(headerLength) : value);
		header = false;
	}
}

async function open({ folder: folderName, name, host, restored }: Extract<RecordingWorkerRequest, { type: 'open' }>) {
	fileName = name;
	folder = await (await navigator.storage.getDirectory()).getDirectoryHandle(folderName, { create: true });
	file = await (await folder.getFileHandle(name, { create: true })).createSyncAccessHandle();
	writer = new DataLogWriter();
	if (restored) {
		// Drops a damaged end, and finishes every entry so the new writer can start its entry IDs over
		file.truncate(restored.length);
		position = restored.length;
		write(finishRecords(restored.openEntryIds, restored.time));
	}
	recorder = new Recorder(writer, host, restored?.clock);
	void drain(writer.readable, restored !== undefined);
	setInterval(() => {
		try {
			file?.flush();
		} catch (error) {
			fail(error);
		}
	}, flushInterval);
}

function read(request: number): void {
	try {
		if (!file) {
			throw new Error('Nothing was recorded.');
		}
		file.flush();
		const size = file.getSize();
		const chunks: Uint8Array<ArrayBuffer>[] = [];
		for (let at = 0; at < size; at += readChunkLength) {
			const chunk = new Uint8Array(Math.min(readChunkLength, size - at));
			file.read(chunk, { at });
			chunks.push(chunk);
		}
		postMessage({ type: 'read', request, file: new Blob(chunks) } satisfies RecordingWorkerMessage);
	} catch (error) {
		postMessage({ type: 'read', request, error: message(error) } satisfies RecordingWorkerMessage);
	}
}

async function remove(): Promise<void> {
	writer?.close();
	file?.close();
	file = undefined;
	await folder?.removeEntry(fileName).catch(() => {});
	postMessage({ type: 'deleted' } satisfies RecordingWorkerMessage);
}

async function handle(request: RecordingWorkerRequest): Promise<void> {
	switch (request.type) {
		case 'open':
			await open(request);
			break;
		case 'events':
			if (!failed && recorder) {
				for (const event of request.events) {
					recorder.record(event);
				}
			}
			break;
		case 'read':
			read(request.request);
			break;
		case 'delete':
			await remove();
			break;
	}
}

// Requests wait for the file to open, in the order they were sent
let queue = Promise.resolve();
addEventListener('message', ({ data }: MessageEvent<RecordingWorkerRequest>) => {
	queue = queue.then(() => handle(data)).catch(fail);
});
