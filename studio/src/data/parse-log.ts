// oxlint-disable max-lines -- Each record is read into the entries, schemas, and recording it belongs to in one pass
import {
	type ControlRecordPayload,
	ControlRecordType,
	type DataRecord,
	type DecodedRecord,
	type DecodeRecordsOptions,
	type IndexedEntry,
	isDataRecord,
	parseStructSpecification,
	type StructDeclaration,
} from 'wpilog-parser';
import { isRecordingEntry, readRecordingValue, type RecordingInfo } from '@/data/read-recording';
import {
	createSamples,
	embeddedLogFormat,
	fromTransfer,
	getEntryKind,
	isSchemaEntry,
	isStudioEntry,
	normalizeEntryName,
	type Samples,
	type Value,
} from '@/data/samples';

export type ParsedEntry = { type: string; metadata: string; samples: Samples };

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
export type Target =
	| { kind: 'recording'; name: string }
	| { kind: 'schema'; name: string }
	| { kind: 'embedded'; name: string }
	| { kind: 'samples'; entry: ParsedEntry }
	| null;

/** Accumulates decoded WPILOG records into entries, struct schemas, time bounds, and live-recording metadata */
export class LogAccumulator {
	readonly entries = new Map<string, ParsedEntry>();
	readonly structSchemas = new Map<string, StructDeclaration[]>();
	private readonly names = new Map<number, string>();
	// The latest value each entry was set to before the log started, see `finish()`
	private readonly beforeStart = new Map<Samples, { timestamp: number; value: Value }>();
	private readonly openEntryIds = new Set<number>();
	// Records of embedded logs by entry name, joined in `finish()`
	private readonly embeddedChunks = new Map<string, { timestamp: number; bytes: Uint8Array }[]>();
	// Samples whose values from before the log started were added, see `finishEntries()`
	private readonly finished = new Set<Samples>();
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
		this.addData(target, record);
	}

	/** Add an entry like its Start record does, for a log whose records are read in any order, see `LogReader` */
	startEntry(entry: IndexedEntry): void {
		handleControlRecord(
			{
				controlRecordType: ControlRecordType.Start,
				entryId: entry.entryId,
				entryName: entry.name,
				entryType: entry.type,
				entryMetadata: entry.metadata,
			},
			this.entries,
			this.names,
		);
	}

	/** Add a data record of an entry whose records are for `target`, see `target()` */
	addData(target: Target, record: DataRecord): void {
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
		const value = toValue(record, target.entry.type);
		if (value !== undefined) {
			this.addValue(target.entry, record.timestamp, value);
		}
	}

	/**
	 * Add every value of a number entry's records at once, `timestamps` and `values` are in file order and only the first
	 * `length` are used. Takes ownership of the arrays.
	 */
	addNumbers(
		entry: ParsedEntry,
		timestamps: Float64Array<ArrayBuffer>,
		values: Float64Array<ArrayBuffer>,
		length: number,
	): void {
		// Used as they are when they're the entry's only samples, in order and after the log started, like most are
		let usable =
			length > 0 && entry.samples.length === 0 && !this.beforeStart.has(entry.samples) && timestamps[0]! >= 0;
		for (let i = 1; usable && i < length; i++) {
			usable = timestamps[i]! >= timestamps[i - 1]!;
		}
		if (usable) {
			entry.samples = fromTransfer({ timestamps, numbers: values, length });
			this.extend(timestamps[0]!);
			this.extend(timestamps[length - 1]!);
			return;
		}
		for (let i = 0; i < length; i++) {
			this.addValue(entry, timestamps[i]!, values[i]!);
		}
	}

	private addValue(entry: ParsedEntry, timestamp: number, value: Value): void {
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
	target(entryName: string, type: string): Target {
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

	/** Include `timestamp` in the log's time range */
	extend(timestamp: number): void {
		if (timestamp < this.start) {
			this.start = timestamp;
		}
		if (timestamp > this.end) {
			this.end = timestamp;
		}
	}

	/** The log's time range, from the records added and for a recorded live session, when it connected */
	timeRange(): { start: number | undefined; end: number | undefined } {
		const hasData = this.start <= this.end;
		const start = hasData ? this.start : undefined;
		const end = hasData ? this.end : undefined;
		const connectedAt = this.recording?.connections[0]?.start;
		if (connectedAt !== undefined) {
			return { start: connectedAt, end: Math.max(end ?? connectedAt, this.recording!.end) };
		}
		return { start, end };
	}

	/**
	 * Add the values entries had before the log started, and for a recorded live session, before it connected. Call
	 * once their records and the log's time range have been added.
	 */
	finishEntries(entries: Iterable<ParsedEntry>): void {
		// They're the values at the start of the log, unless the entry was logged again right as it started
		const first = this.start <= this.end ? this.start : 0;
		// A recorded live session starts when it first connected, values from before then are its values at the start
		const connectedAt = this.recording?.connections[0]?.start;
		for (const { samples } of entries) {
			if (this.finished.has(samples)) {
				continue;
			}
			this.finished.add(samples);
			const before = this.beforeStart.get(samples);
			if (before !== undefined && (samples.length === 0 || samples.timestamps[0]! > first)) {
				samples.push(first, before.value);
			}
			if (connectedAt !== undefined) {
				samples.trimBefore(connectedAt);
				if (samples.length > 0 && samples.timestamps[0]! < connectedAt) {
					samples.timestamps[0] = connectedAt;
				}
			}
		}
	}

	finish(totalBytes: number, readBytes: number): ParsedLog {
		this.finishEntries(this.entries.values());
		return {
			entries: this.entries,
			structSchemas: this.structSchemas,
			...this.timeRange(),
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

/** Called with where each data record ends in a log's file, and its time, in any order */
export type OnRecord = (end: number, timestamp: number) => void;
