// Parses WPILOG files off the main thread so the UI stays responsive while large logs load
import type { StructDeclaration } from 'wpilib-struct';
import { XzReadableStream } from 'xz-decompress';
import { parseLog } from '@/data/parse-log';
import { recordedGaps, type RestoredRecording, toLiveTimes } from '@/data/read-recording';
import type { Value } from '@/data/samples';
import { isXz } from '@/data/xz';

/** A live session read back from its recording, with what's needed to continue writing it */
export type RestoredLog = RestoredRecording & {
	/** Bytes of the file that were read, anything after them is damaged */
	length: number;
	openEntryIds: number[];
};

/** What the worker is sent: a log, and whether it's the recording of a live session to restore */
export type LogWorkerRequest = { contents: File | ArrayBuffer; live: boolean };

/**
 * Messages posted by the worker, in order: `progress` while parsing, `schemas`, one `entry` per entry, then `done` or
 * `error`
 */
export type LogWorkerMessage =
	| {
			type: 'progress';
			/** Fraction of the file parsed, from 0 to 1 */
			progress: number;
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

function parse(bytes: Uint8Array, live: boolean): void {
	const parsed = parseLog(bytes, (progress) => {
		postMessage({ type: 'progress', progress } satisfies LogWorkerMessage);
	});
	const { entries, structSchemas, recording, unreadBytes } = parsed;
	let { start, end } = parsed;
	let gaps: { start: number; end: number }[] = [];
	let restored: RestoredLog | undefined;
	if (recording !== undefined && end !== undefined && !live) {
		gaps = recordedGaps(recording, end);
	} else if (recording !== undefined && end !== undefined) {
		const session = toLiveTimes(entries.values(), recording, end);
		if (session) {
			restored = { ...session, length: bytes.byteLength - unreadBytes, openEntryIds: parsed.openEntryIds };
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
		size: bytes.byteLength,
		unreadBytes,
		gaps,
		restored,
	} satisfies LogWorkerMessage);
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

async function parseInput({ contents, live }: LogWorkerRequest): Promise<void> {
	try {
		const bytes = new Uint8Array(contents instanceof File ? await contents.arrayBuffer() : contents);
		parse(isXz(bytes) ? await decompress(bytes) : bytes, live);
	} catch (error) {
		postMessage({
			type: 'error',
			message: error instanceof Error ? error.message : String(error),
		} satisfies LogWorkerMessage);
	}
}

addEventListener('message', (event: MessageEvent<LogWorkerRequest>) => {
	void parseInput(event.data);
});
