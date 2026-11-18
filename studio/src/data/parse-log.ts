import {
	type ControlRecordPayload,
	ControlRecordType,
	type DataRecord,
	isDataRecord,
	parseDataLog,
} from 'wpilog-parser';
import { isSchemaEntry, isStudioEntry, normalizeEntryName, Samples, type Value } from '@/data/samples';

type ParsedEntry = { type: string; metadata: string; samples: Samples };

export type ParsedLog = {
	/** Entries by normalized name */
	entries: Map<string, ParsedEntry>;
	/** Timestamp of the first data record */
	start: number | undefined;
	end: number | undefined;
	/**
	 * Bytes at the end of the file that couldn't be read, everything after the first damaged record.
	 * A robot that loses power can leave a partial last record, or blocks the file system reserved but never wrote.
	 */
	unreadBytes: number;
};

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
	if (isSchemaEntry(name) || isStudioEntry(name)) {
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

/**
 * Read every entry of a WPILOG file. Throws if it isn't a WPILOG file, or if it's so damaged that none of its entries could be read.
 * Calls `onProgress` with the fraction of the file parsed, from 0 to 1, only when it changes by a whole percent so a worker doesn't flood the main thread with messages.
 */
export function parseLog(bytes: Uint8Array, onProgress: (progress: number) => void): ParsedLog {
	const entries = new Map<string, ParsedEntry>();
	const names = new Map<number, string>();
	let start: number | undefined;
	let end: number | undefined;
	// Unwritten blocks hold leftover data, not zeros, which reads as records for entries that were never started
	const records = parseDataLog(bytes, { strict: true });
	let percent = 0;
	// The end of the last record read, since `records.bytesRead` skips to the end of the file when the last record is cut off
	let readBytes = records.bytesRead;

	try {
		for (const record of records) {
			readBytes = records.bytesRead;
			const nextPercent = Math.floor((readBytes / bytes.byteLength) * 100);
			if (nextPercent !== percent) {
				percent = nextPercent;
				onProgress(percent / 100);
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
		if (entries.size === 0) {
			throw new Error("It's damaged, and none of it could be read.", { cause: error });
		}
		// Keep every record read before the damage
	}

	return { entries, start, end, unreadBytes: bytes.byteLength - readBytes };
}
