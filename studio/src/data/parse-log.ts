// oxlint-disable max-lines -- Each record is read into the entries, schemas, and recording it belongs to in one pass
import {
	type ControlRecordPayload,
	ControlRecordType,
	type DataRecord,
	type DecodedRecord,
	type DecodeRecordsOptions,
	isDataRecord,
	parseDataLog,
	parseStructSpecification,
	type StructDeclaration,
} from 'wpilog-parser';
import { isRecordingEntry, readRecordingValue, type RecordingInfo } from '@/data/read-recording';
import {
	createSamples,
	embeddedLogFormat,
	getEntryKind,
	isSchemaEntry,
	isStudioEntry,
	normalizeEntryName,
	type Samples,
	type Value,
} from '@/data/samples';

type ParsedEntry = { type: string; metadata: string; samples: Samples };

/** A log embedded in an entry of another log, see `embeddedLogFormat` */
export type EmbeddedLog = {
	/** The entry it's embedded in */
	name: string;
	/** File extension, ex. `hoot` */
	format: string;
	/** The embedded log's file, its entry's records joined in order */
	bytes: Uint8Array<ArrayBuffer>;
	/** Where each capture of it ends in `bytes`, and when it was added to the log it's embedded in, in time order */
	captures: { end: number; time: number }[];
};

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
	/** Logs embedded in entries, ex. vendor logs */
	embeddedLogs: EmbeddedLog[];
};

const textDecoder = new TextDecoder();

/**
 * Records for entries that were never started are damage, ex. leftover data in blocks the file system reserved but
 * never wrote, so nothing after them is read. A value that can't be decoded, ex. a struct value shorter than its schema,
 * is a `raw` record instead, so one bad value doesn't hide the rest of the log.
 */
export const logParseOptions = { strict: true, invalidValues: 'raw' } as const satisfies DecodeRecordsOptions;
const structSchemaPrefix = '/.schema/struct:';

function toValue(record: DataRecord, entryType: string): Value | undefined {
	switch (record.type) {
		case 'int64':
			return Number(record.payload);
		case 'int64[]':
			return record.payload.map(Number);
		case 'raw':
			// JSON entries are text. Values that couldn't be decoded, and other raw entries (msgpack, etc.), are unsupported.
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
		entries.set(name, {
			type: payload.entryType,
			metadata: payload.entryMetadata,
			samples: createSamples(getEntryKind(payload.entryType)),
		});
	}
}

function addStructSchema(structSchemas: Map<string, StructDeclaration[]>, name: string, schema: string): void {
	try {
		structSchemas.set(name, parseStructSpecification(schema));
	} catch {
		// Invalid schema, its entries are shown without fields
	}
}

/**
 * What an entry's records are for, worked out from its name and type once instead of for each record, see
 * `LogAccumulator.target()`. `null` for records that aren't kept, ex. of entries that aren't shown.
 */
type Target =
	| { kind: 'recording'; name: string }
	| { kind: 'schema'; name: string }
	| { kind: 'embedded'; name: string }
	| { kind: 'samples'; entry: ParsedEntry }
	| null;

/** Accumulates decoded WPILOG records into entries, struct schemas, time bounds, and live-recording metadata */
export class LogAccumulator {
	readonly entries = new Map<string, ParsedEntry>();
	private readonly structSchemas = new Map<string, StructDeclaration[]>();
	private readonly names = new Map<number, string>();
	// The latest value each entry was set to before the log started, see `finish()`
	private readonly beforeStart = new Map<Samples, { timestamp: number; value: Value }>();
	private readonly openEntryIds = new Set<number>();
	// Records of embedded logs by entry name, joined in `finish()`
	private readonly embeddedChunks = new Map<string, { timestamp: number; bytes: Uint8Array }[]>();
	// Targets by entry ID, unset until worked out. Cleared when an entry starts, since it can replace another's entry.
	private targets: Target[] = [];
	private start = Infinity;
	private end = -Infinity;
	private recording: RecordingInfo | undefined;

	addRecord(record: DecodedRecord): void {
		if (!isDataRecord(record)) {
			const { payload } = record;
			if (payload.controlRecordType === ControlRecordType.Start) {
				this.openEntryIds.add(payload.entryId);
				this.targets = [];
			} else if (payload.controlRecordType === ControlRecordType.Finish) {
				this.openEntryIds.delete(payload.entryId);
			}
			handleControlRecord(payload, this.entries, this.names);
			return;
		}

		const id = record.entry.entryId;
		let target = this.targets[id];
		if (target === undefined) {
			target = this.target(record.entry.name, record.entry.type);
			this.targets[id] = target;
		}
		if (target === null) {
			return;
		}
		switch (target.kind) {
			case 'recording':
				this.recording ??= { host: undefined, status: undefined, connections: [], end: record.timestamp };
				readRecordingValue(this.recording, target.name, record.timestamp, record.payload);
				return;
			case 'schema':
				if (typeof record.payload === 'string') {
					addStructSchema(this.structSchemas, target.name, record.payload);
				}
				return;
			case 'embedded':
				if (record.type === 'raw' && record.payload.byteLength > 0) {
					let chunks = this.embeddedChunks.get(target.name);
					if (!chunks) {
						chunks = [];
						this.embeddedChunks.set(target.name, chunks);
					}
					chunks.push({ timestamp: record.timestamp, bytes: record.payload });
					this.extend(record.timestamp);
				}
				return;
			case 'samples':
				break;
		}
		const { entry } = target;
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
		this.extend(timestamp);
	}

	/** What records of the entry named `entryName` with type `type` are for */
	private target(entryName: string, type: string): Target {
		const name = normalizeEntryName(entryName);
		if (isRecordingEntry(name)) {
			return { kind: 'recording', name };
		}
		if (type === 'structschema') {
			return name.startsWith(structSchemaPrefix)
				? { kind: 'schema', name: name.slice(structSchemaPrefix.length) }
				: null;
		}
		const entry = this.entries.get(name);
		if (!entry) {
			return null;
		}
		return embeddedLogFormat(entry.type) === undefined ? { kind: 'samples', entry } : { kind: 'embedded', name };
	}

	private extend(timestamp: number): void {
		if (timestamp < this.start) {
			this.start = timestamp;
		}
		if (timestamp > this.end) {
			this.end = timestamp;
		}
	}

	finish(totalBytes: number, readBytes: number): ParsedLog {
		const hasData = this.start <= this.end;
		let start = hasData ? this.start : undefined;
		let end = hasData ? this.end : undefined;
		// They're the values at the start of the log, unless the entry was logged again right as it started
		const first = start ?? 0;
		for (const [samples, { value }] of this.beforeStart) {
			if (samples.length === 0 || samples.timestamps[0]! > first) {
				samples.push(first, value);
			}
		}

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
			embeddedLogs: this.joinEmbeddedLogs(),
		};
	}

	private joinEmbeddedLogs(): EmbeddedLog[] {
		return [...this.embeddedChunks].map(([name, chunks]) => {
			// Stable, so chunks written at the same time stay in the order they were logged
			chunks.sort((a, b) => a.timestamp - b.timestamp);
			const bytes = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.bytes.byteLength, 0));
			const captures: EmbeddedLog['captures'] = [];
			let offset = 0;
			for (const chunk of chunks) {
				bytes.set(chunk.bytes, offset);
				offset += chunk.bytes.byteLength;
				captures.push({ end: offset, time: chunk.timestamp });
			}
			const format = embeddedLogFormat(this.entries.get(name)!.type)!;
			return { name, format, bytes, captures };
		});
	}
}

/** Called with where each data record ends in a log's file, and its time, in file order */
export type OnRecord = (end: number, timestamp: number) => void;

/**
 * Read every entry of a WPILOG file. Throws if it isn't a WPILOG file, or if it's so damaged that none of its entries could be read.
 * Calls `onProgress` with the fraction of the file parsed, from 0 to 1, only when it changes by a whole percent so a worker doesn't flood the main thread with messages.
 */
export function parseLog(bytes: Uint8Array, onProgress: (progress: number) => void, onRecord?: OnRecord): ParsedLog {
	const accumulator = new LogAccumulator();
	// Unwritten blocks hold leftover data, not zeros, which reads as records for entries that were never started
	const records = parseDataLog(bytes, logParseOptions);
	let percent = 0;
	// Bytes read when the progress reaches the next whole percent, so it's only worked out once per percent
	let nextProgress = 0;
	// The end of the last record read, since `records.bytesRead` skips to the end of the file when the last record is cut off
	let readBytes = records.bytesRead;

	try {
		for (const record of records) {
			readBytes = records.bytesRead;
			if (readBytes >= nextProgress) {
				const next = Math.floor((readBytes / bytes.byteLength) * 100);
				if (next !== percent) {
					percent = next;
					onProgress(percent / 100);
				}
				nextProgress = Math.max(readBytes + 1, Math.ceil(((percent + 1) / 100) * bytes.byteLength));
			}
			if (onRecord && isDataRecord(record)) {
				onRecord(readBytes, record.timestamp);
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
