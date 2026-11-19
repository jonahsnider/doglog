// Parses WPILOG files off the main thread so the UI stays responsive while large logs load
import type { StructDeclaration } from 'wpilib-struct';
import { parseLog } from '@/data/parse-log';
import type { Value } from '@/data/samples';

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
			/** Timestamp of the first data record */
			start: number | undefined;
			end: number | undefined;
			/** Bytes at the end of the file that couldn't be read */
			unreadBytes: number;
	  }
	| { type: 'error'; message: string };

function parse(bytes: Uint8Array): void {
	const { entries, structSchemas, start, end, unreadBytes } = parseLog(bytes, (progress) => {
		postMessage({ type: 'progress', progress } satisfies LogWorkerMessage);
	});
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

	postMessage({ type: 'done', start, end, unreadBytes } satisfies LogWorkerMessage);
}

async function parseFile(file: File): Promise<void> {
	try {
		parse(new Uint8Array(await file.arrayBuffer()));
	} catch (error) {
		postMessage({
			type: 'error',
			message: error instanceof Error ? error.message : String(error),
		} satisfies LogWorkerMessage);
	}
}

addEventListener('message', (event: MessageEvent<File>) => {
	void parseFile(event.data);
});
