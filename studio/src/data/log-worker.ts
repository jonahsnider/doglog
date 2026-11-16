// Parses WPILOG files off the main thread so the UI stays responsive while large logs load
import {
	type ControlRecordPayload,
	ControlRecordType,
	type DataRecord,
	isDataRecord,
	parseDataLog,
} from 'wpilog-parser';
import { isSchemaEntry, normalizeEntryName, Samples, type Value } from '@/data/samples';

/** Messages posted by the worker, in order: `progress` while parsing, one `entry` per entry, then `done` or `error` */
export type LogWorkerMessage =
	| {
			type: 'progress';
			/** Fraction of the file parsed, from 0 to 1 */
			progress: number;
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
			/** Some records couldn't be read, ex. the log was cut off by a power loss */
			damaged: boolean;
	  }
	| { type: 'error'; message: string };

const textDecoder = new TextDecoder();

function toValue(record: DataRecord, entryType: string): Value | undefined {
	switch (record.type) {
		case 'int64':
			return Number(record.payload);
		case 'int64[]':
			return record.payload.map(Number);
		case 'raw':
			// JSON entries are text, other raw entries (protobuf, msgpack, etc.) are unsupported
			return entryType === 'json' ? textDecoder.decode(record.payload) : undefined;
		default:
			return record.payload;
	}
}

type ParsedEntry = { type: string; metadata: string; samples: Samples };

/** Add entries from start records and update their metadata, `names` maps entry IDs to names since set metadata records only have the ID */
function handleControlRecord(
	payload: ControlRecordPayload,
	entries: Map<string, ParsedEntry>,
	names: Map<number, string>,
): void {
	if (payload.controlRecordType === ControlRecordType.SetMetadata) {
		const entry = entries.get(names.get(payload.entryId) ?? '');
		if (entry) {
			entry.metadata = payload.entryMetadata;
		}
		return;
	}
	if (payload.controlRecordType !== ControlRecordType.Start) {
		return;
	}

	const name = normalizeEntryName(payload.entryName);
	// The parser reads schemas itself
	if (isSchemaEntry(name)) {
		return;
	}
	names.set(payload.entryId, name);
	const existing = entries.get(name);
	if (existing?.type === payload.entryType) {
		existing.metadata = payload.entryMetadata;
	} else {
		entries.set(name, { type: payload.entryType, metadata: payload.entryMetadata, samples: new Samples() });
	}
}

function parse(bytes: Uint8Array): void {
	const entries = new Map<string, ParsedEntry>();
	const names = new Map<number, string>();
	let start: number | undefined;
	let end: number | undefined;
	let damaged = false;

	const records = parseDataLog(bytes);
	let percent = 0;

	try {
		for (const record of records) {
			// Only report whole percent changes, so the main thread isn't flooded with messages
			const nextPercent = Math.floor((records.bytesRead / bytes.byteLength) * 100);
			if (nextPercent !== percent) {
				percent = nextPercent;
				postMessage({ type: 'progress', progress: percent / 100 } satisfies LogWorkerMessage);
			}

			if (!isDataRecord(record)) {
				handleControlRecord(record.payload, entries, names);
				continue;
			}

			const entry = entries.get(normalizeEntryName(record.entry.name));
			if (!entry) {
				continue;
			}
			const value = toValue(record, entry.type);
			if (value === undefined) {
				continue;
			}

			const { timestamp } = record;
			entry.samples.push(timestamp, value);
			start = start === undefined ? timestamp : Math.min(start, timestamp);
			end = end === undefined ? timestamp : Math.max(end, timestamp);
		}
	} catch (error) {
		// The header was read (it throws before yielding anything otherwise), keep every record read before the damage
		if (entries.size === 0) {
			throw error;
		}
		damaged = true;
	}
	damaged ||= records.truncated;

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

	postMessage({ type: 'done', start, end, damaged } satisfies LogWorkerMessage);
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
