// oxlint-disable max-lines -- Reading a log and sending its entries in order share the messages the worker posts
// Parses log files off the main thread so the UI stays responsive while large logs load
import type { StructDeclaration } from 'wpilib-struct';
import { XzReadableStream } from 'xz-decompress';
import { decompress } from '@/data/decompress';
import { addEmbeddedLogs } from '@/data/embedded-logs';
import { parseHoot } from '@/data/parse-hoot';
import { type ParsedLog, parseLog } from '@/data/parse-log';
import { recordedGaps, type RestoredRecording, toLiveTimes } from '@/data/read-recording';
import { type SamplesTransfer, transferables, withoutNtPrefix } from '@/data/samples';
import { StreamingLogParser } from '@/data/stream-log';
import { isXz } from '@/data/xz';

/** A live session read back from its recording, with what's needed to continue writing it */
export type RestoredLog = RestoredRecording & {
	/** Bytes of the file that were read, anything after them is damaged */
	length: number;
	openEntryIds: number[];
};

/** Entries to send first, so widgets draw them while the rest are sent */
export type LogPriority = {
	/** Names of entries dashboards bind, without the prefix of topics a log recorded from NetworkTables */
	names: string[];
	/** Prefixes of entries Studio reads without a binding, ex. for the timeline */
	prefixes: string[];
};

/** Messages sent to the worker: either a complete buffer/File or an incremental download stream */
export type LogWorkerRequest =
	| { kind: 'buffer'; contents: File | ArrayBuffer; live: boolean; format: 'wpilog' | 'hoot'; priority: LogPriority }
	| { kind: 'stream-start'; totalBytes: number | undefined; priority: LogPriority }
	| { kind: 'stream-chunk'; chunk: ArrayBuffer; downloadedBytes: number }
	| { kind: 'stream-end' }
	| { kind: 'stream-error'; message: string };

/**
 * Messages posted by the worker, in order: `progress` while parsing/downloading, then `schemas` and one `entry` per entry
 * (sent again for entries of embedded logs), then `done` or `error`. Entries can be added as they arrive.
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
			/** Samples in the entries that follow, for progress while they're sent */
			samples: number;
			/** The log's time range so far, `done` has the final one */
			start: number | undefined;
			end: number | undefined;
	  }
	| {
			type: 'entry';
			name: string;
			entryType: string;
			/** The entry's latest metadata string */
			metadata: string;
			samples: SamplesTransfer;
			/** For an entry with a log embedded in it, the embedded log's file */
			embeddedLog: Uint8Array<ArrayBuffer> | undefined;
			/** Whether Studio reads it without being asked, ex. a dashboard binds it, see `LogPriority` */
			priority: boolean;
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

/** Whether a widget or Studio reads an entry, from its name, see `LogPriority` */
function priorityTest({ names, prefixes }: LogPriority): (name: string) => boolean {
	const bound = new Set(names);
	// Entries whose fields or items are bound, ex. `/Pose` for `/Pose/x`
	const parents = new Set(names.flatMap((name) => parentPaths(name)));
	return (name) => {
		const bare = withoutNtPrefix(name);
		// Bound, or in a bound group, ex. a Mechanism2d's
		return (
			bound.has(bare) ||
			parents.has(bare) ||
			parentPaths(bare).some((path) => bound.has(path)) ||
			prefixes.some((prefix) => bare.startsWith(prefix))
		);
	};
}

/** `/a` and `/a/b` for `/a/b/c` */
function parentPaths(name: string): string[] {
	const paths: string[] = [];
	for (let end = name.lastIndexOf('/'); end > 0; end = name.lastIndexOf('/', end - 1)) {
		paths.push(name.slice(0, end));
	}
	return paths;
}

/**
 * Send the time range, schemas, and the entries of `parsed` that weren't sent yet, the ones `isPriority` picks first.
 * Entries with an embedded log are sent once `embedded`, since its file is read until then.
 */
function postEntries(
	parsed: ParsedLog,
	{ start, end }: { start: number | undefined; end: number | undefined },
	sent: Set<string>,
	isPriority: (name: string) => boolean,
	embedded: boolean,
): void {
	const embeddedLogs = new Map(parsed.embeddedLogs.map(({ name, bytes }) => [name, bytes]));
	const names = [...parsed.entries.keys()].filter((name) => !sent.has(name) && (embedded || !embeddedLogs.has(name)));
	let samples = 0;
	for (const name of names) {
		samples += parsed.entries.get(name)!.samples.length;
	}
	postMessage({ type: 'schemas', structSchemas: parsed.structSchemas, samples, start, end } satisfies LogWorkerMessage);

	const ordered = [...names.filter((name) => isPriority(name)), ...names.filter((name) => !isPriority(name))];
	for (const name of ordered) {
		sent.add(name);
		const { type, metadata, samples: entrySamples } = parsed.entries.get(name)!;
		const embeddedLog = embeddedLogs.get(name);
		const transfer = entrySamples.toTransfer();
		const message: LogWorkerMessage = {
			type: 'entry',
			name,
			entryType: type,
			metadata,
			samples: transfer,
			embeddedLog,
			priority: isPriority(name),
		};
		postMessage(message, { transfer: [...transferables(transfer), ...(embeddedLog ? [embeddedLog.buffer] : [])] });
	}
}

async function postParsed(parsed: ParsedLog, byteLength: number, live: boolean, priority: LogPriority): Promise<void> {
	// Embedded logs are read while the log's own entries are sent
	const embedding = addEmbeddedLogs(parsed);
	const sent = new Set<string>();
	const isPriority = priorityTest(priority);
	// A live session's recording is sent once it's on Studio's clock, see `toLiveTimes()`
	if (!live) {
		postEntries(parsed, parsed, sent, isPriority, false);
	}
	await embedding;

	const { entries, recording, unreadBytes } = parsed;
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
	postEntries(parsed, { start, end }, sent, isPriority, true);

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

class StreamSession {
	private readonly parser = new StreamingLogParser();
	private readonly totalBytes: number | undefined;
	private readonly priority: LogPriority;
	private mode: 'detect' | 'raw' | 'xz' = 'detect';
	private probe = new Uint8Array(0);
	private decompressedBytes = 0;
	private percent = -1;
	private xzController: ReadableStreamDefaultController<Uint8Array> | undefined;
	private xzDone: Promise<void> | undefined;
	private xzError: string | undefined;
	private ended = false;

	constructor(totalBytes: number | undefined, priority: LogPriority) {
		this.totalBytes = totalBytes;
		this.priority = priority;
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
			await postParsed(parsed, this.decompressedBytes, false, this.priority);
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
				const input = new Uint8Array(
					request.contents instanceof File ? await request.contents.arrayBuffer() : request.contents,
				);
				const bytes = request.format === 'wpilog' && isXz(input) ? await decompress(input) : input;
				const parse = request.format === 'hoot' ? parseHoot : parseLog;
				const parsed = parse(bytes, (progress) => {
					postMessage({ type: 'progress', progress } satisfies LogWorkerMessage);
				});
				await postParsed(parsed, bytes.byteLength, request.live, request.priority);
			} catch (error) {
				postMessage({
					type: 'error',
					message: error instanceof Error ? error.message : String(error),
				} satisfies LogWorkerMessage);
			}
			return;
		}
		case 'stream-start':
			activeStream = new StreamSession(request.totalBytes, request.priority);
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
