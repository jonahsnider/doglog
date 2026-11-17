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
	/** Some records couldn't be read, ex. the log was cut off by a power loss */
	damaged: boolean;
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
 * Read every entry of a WPILOG file. Throws if it isn't a WPILOG file.
 * Calls `onProgress` with the fraction of the file parsed, from 0 to 1, only when it changes by a whole percent so a worker doesn't flood the main thread with messages.
 */
export function parseLog(bytes: Uint8Array, onProgress: (progress: number) => void): ParsedLog {
	const entries = new Map<string, ParsedEntry>();
	const names = new Map<number, string>();
	let start: number | undefined;
	let end: number | undefined;
	let damaged = false;

	const records = parseDataLog(bytes);
	let percent = 0;

	try {
		for (const record of records) {
			const nextPercent = Math.floor((records.bytesRead / bytes.byteLength) * 100);
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
		// The header was read (it throws before yielding anything otherwise), keep every record read before the damage
		if (entries.size === 0) {
			throw error;
		}
		damaged = true;
	}
	damaged ||= records.truncated;

	return { entries, start, end, damaged };
}
