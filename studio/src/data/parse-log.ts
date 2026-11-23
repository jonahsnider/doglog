import {
	type ControlRecordPayload,
	ControlRecordType,
	type DataRecord,
	type DecodedRecord,
	isDataRecord,
	parseDataLog,
	parseStructSpecification,
	type StructDeclaration,
} from 'wpilog-parser';
import { isRecordingEntry, readRecordingValue, type RecordingInfo } from '@/data/read-recording';
import { isSchemaEntry, isStudioEntry, normalizeEntryName, Samples, type Value } from '@/data/samples';

type ParsedEntry = { type: string; metadata: string; samples: Samples };

export type ParsedLog = {
	/** Entries by normalized name */
	entries: Map<string, ParsedEntry>;
	/** Fields of the log's struct schemas by struct name, ex. `Pose2d` */
	structSchemas: Map<string, StructDeclaration[]>;
	start: number | undefined;
	end: number | undefined;
	/**
	 * Bytes at the end of the file that couldn't be read, everything after the first damaged record.
	 * A robot that loses power can leave a partial last record, or blocks the file system reserved but never wrote.
	 */
	unreadBytes: number;
	/** For a live session Studio recorded, when it connected */
	recording: RecordingInfo | undefined;
	/** IDs of entries that were started and not finished, including ones that aren't shown */
	openEntryIds: number[];
};

const textDecoder = new TextDecoder();
const structSchemaPrefix = '/.schema/struct:';

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

function addStructSchema(structSchemas: Map<string, StructDeclaration[]>, name: string, schema: string): void {
	try {
		structSchemas.set(name, parseStructSpecification(schema));
	} catch {
		// Invalid schema, its entries are shown without fields
	}
}

/** Accumulates decoded WPILOG records into entries, struct schemas, time bounds, and live-recording metadata */
export class LogAccumulator {
	readonly entries = new Map<string, ParsedEntry>();
	private readonly structSchemas = new Map<string, StructDeclaration[]>();
	private readonly names = new Map<number, string>();
	// The latest value each entry was set to before the log started, see `finish()`
	private readonly beforeStart = new Map<Samples, { timestamp: number; value: Value }>();
	private readonly openEntryIds = new Set<number>();
	private start: number | undefined;
	private end: number | undefined;
	private recording: RecordingInfo | undefined;

	addRecord(record: DecodedRecord): void {
		if (!isDataRecord(record)) {
			const { payload } = record;
			if (payload.controlRecordType === ControlRecordType.Start) {
				this.openEntryIds.add(payload.entryId);
			} else if (payload.controlRecordType === ControlRecordType.Finish) {
				this.openEntryIds.delete(payload.entryId);
			}
			handleControlRecord(payload, this.entries, this.names);
			return;
		}

		const name = normalizeEntryName(record.entry.name);
		if (isRecordingEntry(name)) {
			this.recording ??= { host: undefined, status: undefined, connections: [], end: record.timestamp };
			readRecordingValue(this.recording, name, record.timestamp, record.payload);
			return;
		}
		if (record.entry.type === 'structschema') {
			if (name.startsWith(structSchemaPrefix) && typeof record.payload === 'string') {
				addStructSchema(this.structSchemas, name.slice(structSchemaPrefix.length), record.payload);
			}
			return;
		}
		const entry = this.entries.get(name);
		if (!entry) {
			return;
		}
		const value = toValue(record, entry.type);
		if (value === undefined) {
			return;
		}

		const { timestamp } = record;
		// NetworkTables values set before the log started, ex. by a coprocessor, are logged with negative timestamps.
		// Placed at their real time, they'd make the log start up to hours before the robot did.
		if (timestamp < 0) {
			if (timestamp >= (this.beforeStart.get(entry.samples)?.timestamp ?? -Infinity)) {
				this.beforeStart.set(entry.samples, { timestamp, value });
			}
			return;
		}
		entry.samples.push(timestamp, value);
		this.start = this.start === undefined ? timestamp : Math.min(this.start, timestamp);
		this.end = this.end === undefined ? timestamp : Math.max(this.end, timestamp);
	}

	finish(totalBytes: number, readBytes: number): ParsedLog {
		// They're the values at the start of the log, unless the entry was logged again right as it started
		const first = this.start ?? 0;
		for (const [samples, { value }] of this.beforeStart) {
			if (samples.length === 0 || samples.timestamps[0]! > first) {
				samples.push(first, value);
			}
		}

		let { start, end } = this;
		// A recorded live session starts when it first connected, values from before then are its values at the start
		const connectedAt = this.recording?.connections[0]?.start;
		if (connectedAt !== undefined) {
			for (const { samples } of this.entries.values()) {
				samples.trimBefore(connectedAt);
				if (samples.length > 0 && samples.timestamps[0]! < connectedAt) {
					samples.timestamps[0] = connectedAt;
				}
			}
			start = connectedAt;
			end = Math.max(end ?? connectedAt, this.recording!.end);
		}

		return {
			entries: this.entries,
			structSchemas: this.structSchemas,
			start,
			end,
			unreadBytes: totalBytes - readBytes,
			recording: this.recording,
			openEntryIds: [...this.openEntryIds],
		};
	}
}

/**
 * Read every entry of a WPILOG file. Throws if it isn't a WPILOG file, or if it's so damaged that none of its entries could be read.
 * Calls `onProgress` with the fraction of the file parsed, from 0 to 1, only when it changes by a whole percent so a worker doesn't flood the main thread with messages.
 */
export function parseLog(bytes: Uint8Array, onProgress: (progress: number) => void): ParsedLog {
	const accumulator = new LogAccumulator();
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
			accumulator.addRecord(record);
		}
	} catch (error) {
		if (accumulator.entries.size === 0) {
			throw new Error("It's damaged, and none of it could be read.", { cause: error });
		}
		// Keep every record read before the damage
	}

	return accumulator.finish(bytes.byteLength, readBytes);
}
