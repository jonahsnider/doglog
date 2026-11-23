// Parses WPILOG files off the main thread so the UI stays responsive while large logs load
import type { StructDeclaration } from 'wpilib-struct';
import { XzReadableStream } from 'xz-decompress';
import { type ParsedLog, parseLog } from '@/data/parse-log';
import { recordedGaps, type RestoredRecording, toLiveTimes } from '@/data/read-recording';
import type { Value } from '@/data/samples';
import { StreamingLogParser } from '@/data/stream-log';
import { isXz } from '@/data/xz';

/** A live session read back from its recording, with what's needed to continue writing it */
export type RestoredLog = RestoredRecording & {
	/** Bytes of the file that were read, anything after them is damaged */
	length: number;
	openEntryIds: number[];
};

/** Messages sent to the worker: either a complete buffer/File or an incremental download stream */
export type LogWorkerRequest =
	| { kind: 'buffer'; contents: File | ArrayBuffer; live: boolean }
	| { kind: 'stream-start'; totalBytes: number | undefined }
	| { kind: 'stream-chunk'; chunk: ArrayBuffer; downloadedBytes: number }
	| { kind: 'stream-end' }
	| { kind: 'stream-error'; message: string };

/**
 * Messages posted by the worker, in order: `progress` while parsing/downloading, `schemas`, one `entry` per entry,
 * then `done` or `error`
 */
export type LogWorkerMessage =
	| {
			type: 'progress';
			/** Fraction parsed or downloaded from 0 to 1, or `undefined` when the total length is unknown */
			progress: number | undefined;
	  }
	| {
			type: 'schemas';
			/** Fields of the log's struct schemas by struct name */
			structSchemas: Map<string, StructDeclaration[]>;
	  }
	| {
			type: 'entry';
			name: string;
			entryType: string;
			/** The entry's latest metadata string */
			metadata: string;
			timestamps: Float64Array<ArrayBuffer>;
			values: Value[];
	  }
	| {
			type: 'done';
			start: number | undefined;
			end: number | undefined;
			/** Bytes in the log, once decompressed */
			size: number;
			/** Bytes at the end of the log that couldn't be read */
			unreadBytes: number;
			/** When a recorded live session was disconnected */
			gaps: { start: number; end: number }[];
			/** For a live session's recording, the session it recorded. Times are on Studio's clock. */
			restored: RestoredLog | undefined;
	  }
	| { type: 'error'; message: string };

function postParsed(parsed: ParsedLog, byteLength: number, live: boolean): void {
	const { entries, structSchemas, recording, unreadBytes } = parsed;
	let { start, end } = parsed;
	let gaps: { start: number; end: number }[] = [];
	let restored: RestoredLog | undefined;
	if (recording !== undefined && end !== undefined && !live) {
		gaps = recordedGaps(recording, end);
	} else if (recording !== undefined && end !== undefined) {
		const session = toLiveTimes(entries.values(), recording, end);
		if (session) {
			restored = { ...session, length: byteLength - unreadBytes, openEntryIds: parsed.openEntryIds };
			({ start, gaps } = session);
			end = session.disconnectedAt;
		}
	}
	postMessage({ type: 'schemas', structSchemas } satisfies LogWorkerMessage);

	for (const [name, { type, metadata, samples }] of entries) {
		const message: LogWorkerMessage = {
			type: 'entry',
			name,
			entryType: type,
			metadata,
			timestamps: samples.timestamps,
			values: samples.values,
		};
		postMessage(message, { transfer: [samples.timestamps.buffer] });
	}

	postMessage({
		type: 'done',
		start,
		end,
		size: byteLength,
		unreadBytes,
		gaps,
		restored,
	} satisfies LogWorkerMessage);
}

function parse(bytes: Uint8Array, live: boolean): void {
	const parsed = parseLog(bytes, (progress) => {
		postMessage({ type: 'progress', progress } satisfies LogWorkerMessage);
	});
	postParsed(parsed, bytes.byteLength, live);
}

/** Decompress a `.wpilogxz` log, keeping what was read before an error since a robot that loses power cuts the file off */
async function decompress(compressed: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
	const chunks: Uint8Array[] = [];
	try {
		await new XzReadableStream(new Blob([compressed]).stream()).pipeTo(
			new WritableStream({ write: (chunk) => void chunks.push(chunk) }),
		);
	} catch {
		// The rest is parsed like an uncompressed log that was cut off
	}
	const bytes = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.byteLength, 0));
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return bytes;
}

class StreamSession {
	private readonly parser = new StreamingLogParser();
	private readonly totalBytes: number | undefined;
	private mode: 'detect' | 'raw' | 'xz' = 'detect';
	private probe = new Uint8Array(0);
	private decompressedBytes = 0;
	private percent = -1;
	private xzController: ReadableStreamDefaultController<Uint8Array> | undefined;
	private xzDone: Promise<void> | undefined;
	private xzError: string | undefined;
	private ended = false;

	constructor(totalBytes: number | undefined) {
		this.totalBytes = totalBytes;
		postMessage({
			type: 'progress',
			progress: totalBytes !== undefined && totalBytes > 0 ? 0 : undefined,
		} satisfies LogWorkerMessage);
	}

	push(chunk: Uint8Array, downloadedBytes: number): void {
		if (this.ended) {
			return;
		}
		if (this.totalBytes !== undefined && this.totalBytes > 0) {
			const nextPercent = Math.min(100, Math.floor((downloadedBytes / this.totalBytes) * 100));
			if (nextPercent !== this.percent) {
				this.percent = nextPercent;
				postMessage({ type: 'progress', progress: nextPercent / 100 } satisfies LogWorkerMessage);
			}
		}

		if (this.mode === 'detect') {
			const combined = new Uint8Array(this.probe.byteLength + chunk.byteLength);
			combined.set(this.probe);
			combined.set(chunk, this.probe.byteLength);
			this.probe = combined;
			if (this.probe.byteLength < 6) {
				return;
			}
			const initial = this.probe;
			this.probe = new Uint8Array(0);
			if (isXz(initial)) {
				this.mode = 'xz';
				this.startXz(initial);
			} else {
				this.mode = 'raw';
				this.decompressedBytes += initial.byteLength;
				this.parser.push(initial);
			}
			return;
		}

		if (this.mode === 'xz') {
			this.xzController?.enqueue(chunk);
		} else {
			this.decompressedBytes += chunk.byteLength;
			this.parser.push(chunk);
		}
	}

	private startXz(initial: Uint8Array): void {
		const input = new ReadableStream<Uint8Array>({
			start: (controller) => {
				this.xzController = controller;
				controller.enqueue(initial);
			},
		});
		this.xzDone = new XzReadableStream(input)
			.pipeTo(
				new WritableStream({
					write: (value) => {
						if (value.byteLength > 0) {
							this.decompressedBytes += value.byteLength;
							this.parser.push(value);
						}
					},
				}),
			)
			.catch((error: unknown) => {
				// Keep what was decompressed before an error, like a log cut off when the robot lost power
				this.xzError = error instanceof Error ? error.message : 'Decompression failed.';
			});
	}

	async finish(): Promise<void> {
		if (this.ended) {
			return;
		}
		this.ended = true;
		try {
			if (this.mode === 'xz') {
				this.xzController?.close();
				await this.xzDone;
				if (this.decompressedBytes === 0 && this.xzError !== undefined) {
					throw new Error(`Couldn't decompress it: ${this.xzError}`);
				}
			} else if (this.mode === 'detect' && this.probe.byteLength > 0) {
				this.decompressedBytes += this.probe.byteLength;
				this.parser.push(this.probe);
			}
			const parsed = this.parser.finish();
			postParsed(parsed, this.decompressedBytes, false);
		} catch (error) {
			postMessage({
				type: 'error',
				message: error instanceof Error ? error.message : String(error),
			} satisfies LogWorkerMessage);
		}
	}

	fail(message: string): void {
		if (this.ended) {
			return;
		}
		this.ended = true;
		try {
			this.xzController?.error(new Error(message));
		} catch {
			// Ignore if already closed
		}
		postMessage({ type: 'error', message } satisfies LogWorkerMessage);
	}
}

let activeStream: StreamSession | undefined;

async function handleRequest(request: LogWorkerRequest): Promise<void> {
	switch (request.kind) {
		case 'buffer': {
			try {
				const bytes = new Uint8Array(
					request.contents instanceof File ? await request.contents.arrayBuffer() : request.contents,
				);
				parse(isXz(bytes) ? await decompress(bytes) : bytes, request.live);
			} catch (error) {
				postMessage({
					type: 'error',
					message: error instanceof Error ? error.message : String(error),
				} satisfies LogWorkerMessage);
			}
			return;
		}
		case 'stream-start':
			activeStream = new StreamSession(request.totalBytes);
			return;
		case 'stream-chunk':
			activeStream?.push(new Uint8Array(request.chunk), request.downloadedBytes);
			return;
		case 'stream-end':
			await activeStream?.finish();
			activeStream = undefined;
			return;
		case 'stream-error':
			activeStream?.fail(request.message);
			activeStream = undefined;
	}
}

addEventListener('message', (event: MessageEvent<LogWorkerRequest>) => {
	void handleRequest(event.data);
});
