import { StructRegistry } from 'wpilib-struct';
import {
	type DataLogIndex,
	DataLogIndexDecoder,
	type IndexedEntry,
	indexDataLog,
	type StructDeclaration,
} from 'wpilog-parser';
import {
	LogAccumulator,
	logParseOptions,
	type OnRecord,
	type ParsedEntry,
	type ParsedLog,
	structSchemaPrefix,
	type Target,
} from '@/data/parse-log';
import { fromTransfer, getEntryKind, type Samples } from '@/data/samples';

/** Whether records of an entry of `type` hold values Studio shows, see `toValue()` */
function hasValues(type: string): boolean {
	return type === 'json' || getEntryKind(type) !== 'unsupported';
}

/**
 * Reads a WPILOG file's entries in any order: finds where every record is first, then decodes the entries asked for,
 * see `read()`. Throws if it isn't a WPILOG file, or if it's so damaged that none of its entries could be read.
 */
export class LogReader {
	private readonly accumulator = new LogAccumulator();
	private readonly index: DataLogIndex;
	private readonly decoder: DataLogIndexDecoder;
	// Entries whose records aren't read yet, in the order they were started, with what their records are for
	private unread: { entry: IndexedEntry; target: NonNullable<Target>; repeated: boolean }[] = [];
	private readonly structDefinitions = new Map<string, string>();
	private readonly structRegistry: StructRegistry | undefined;
	private readonly onProgress: (progress: number) => void;
	private readonly records: number;
	private readRecords = 0;
	private percent = 0;

	/**
	 * Calls `onProgress` with the fraction of records read, from 0 to 1, only when it changes by a whole percent so a
	 * worker doesn't flood the main thread with messages.
	 */
	constructor(bytes: Uint8Array, onProgress: (progress: number) => void = () => {}, onRecord?: OnRecord) {
		this.onProgress = onProgress;
		try {
			// Unwritten blocks hold leftover data, not zeros, which reads as records for entries that were never started
			this.index = indexDataLog(bytes, logParseOptions);
		} catch (error) {
			throw new Error("It's damaged, and none of it could be read.", { cause: error });
		}
		const { entries, error } = this.index;
		// An entry whose type changed replaces the entry with its name, so only its records since then are kept
		const kept = new Map<string, { type: string; entries: IndexedEntry[] }>();
		for (const entry of entries) {
			this.accumulator.startEntry(entry);
			const same = kept.get(entry.name);
			if (same?.type === entry.type) {
				same.entries.push(entry);
			} else {
				kept.set(entry.name, { type: entry.type, entries: [entry] });
			}
		}
		if (error !== undefined && this.accumulator.entries.size === 0) {
			throw new Error("It's damaged, and none of it could be read.", { cause: error });
		}
		const keptEntries = new Set([...kept.values()].flatMap((name) => name.entries));

		let records = 0;
		for (const entry of entries) {
			if (onRecord) {
				for (let i = 0; i < entry.length; i++) {
					onRecord(entry.payloadOffsets[i]! + entry.payloadSizes[i]!, entry.timestamps[i]!);
				}
			}
			const target = this.accumulator.target(entry.name, entry.type);
			if (target === null) {
				continue;
			}
			const shown = target.kind === 'samples' || target.kind === 'embedded';
			if (shown && !keptEntries.has(entry)) {
				continue;
			}
			this.unread.push({ entry, target, repeated: (kept.get(entry.name)?.entries.length ?? 0) > 1 });
			records += entry.length;
			// The time range is known before reading values, so entries can be shown as they're read
			if (target.kind === 'embedded' || (target.kind === 'samples' && hasValues(entry.type))) {
				for (let i = 0; i < entry.length; i++) {
					const timestamp = entry.timestamps[i]!;
					if (timestamp >= 0 && (target.kind === 'samples' || entry.payloadSizes[i]! > 0)) {
						this.accumulator.extend(timestamp);
					}
				}
			}
		}
		this.records = records;
		this.decoder = new DataLogIndexDecoder(this.index, logParseOptions);
		const recording = this.unread.some(({ target }) => target.kind === 'recording');
		// Needed to read other entries
		this.readRecording();
		this.readWhere((kind) => kind === 'schema');
		// A live recording may be appended to, so keep its already-decoded samples. Only pack schemas we can reproduce.
		if (
			!recording &&
			this.structDefinitions.size > 0 &&
			!entries.some((entry) => entry.type === 'structschema' && !entry.name.startsWith(structSchemaPrefix))
		) {
			const registry = new StructRegistry();
			try {
				for (const [name, definition] of this.structDefinitions) {
					registry.register(name, definition);
				}
				this.structRegistry = registry;
			} catch {
				// If the final schema definitions can't be reproduced, use the parser's decoded values.
			}
		}
	}

	/** Read the values Studio wrote to a recorded live session, in file order since they depend on the ones before them */
	private readRecording(): void {
		const records = this.unread
			.filter(({ target }) => target.kind === 'recording')
			.flatMap(({ entry, target }) => Array.from({ length: entry.length }, (_, index) => ({ entry, target, index })))
			.toSorted((a, b) => a.entry.payloadOffsets[a.index]! - b.entry.payloadOffsets[b.index]!);
		for (const { entry, target, index } of records) {
			const record = this.decoder.decode(entry, index);
			if (record) {
				this.accumulator.addData(target, record);
			}
		}
		this.readRecords += records.length;
		this.unread = this.unread.filter(({ target }) => target.kind !== 'recording');
	}

	/** Entries by normalized name, their samples are read by `read()` */
	get entries(): ReadonlyMap<string, ParsedEntry> {
		return this.accumulator.entries;
	}

	/** Fields of the log's struct schemas by struct name */
	get structSchemas(): ReadonlyMap<string, StructDeclaration[]> {
		return this.accumulator.structSchemas;
	}

	timeRange(): { start: number | undefined; end: number | undefined } {
		return this.accumulator.timeRange();
	}

	/** Read the samples of the entries `include` picks by name that weren't read yet, returns their names */
	read(include: (name: string) => boolean): string[] {
		return this.readWhere((_, name) => include(name));
	}

	/** Keep a sorted, single-run struct entry in binary form. Log bytes stay in the worker; only these payloads are sent. */
	private packStruct(entry: IndexedEntry): Samples | undefined {
		const { structRegistry, structDefinitions } = this;
		const { type, timestamps, payloadSizes, payloadOffsets, length } = entry;
		if (!structRegistry || !type.startsWith('struct:') || length === 0 || timestamps[0]! < 0) {
			return undefined;
		}
		const array = type.endsWith('[]');
		const name = type.slice('struct:'.length, array ? -'[]'.length : undefined);
		let stride: string | number;
		try {
			stride = structRegistry.getByteLength(name);
		} catch {
			return undefined;
		}
		if (typeof stride !== 'number' || stride <= 0) {
			return undefined;
		}
		const offsets = new Uint32Array(length + 1);
		let size = 0;
		for (let i = 0; i < length; i++) {
			const bytes = payloadSizes[i]!;
			if ((i > 0 && timestamps[i]! < timestamps[i - 1]!) || (array ? bytes % stride !== 0 : bytes < stride)) {
				return undefined;
			}
			size += array ? bytes : stride;
			if (size > 0xffff_ffff) {
				return undefined;
			}
			offsets[i + 1] = size;
		}
		// Validate that the schema can actually decode before sending its bytes to the UI.
		const first = this.decoder.decode(entry, 0);
		if (first?.type !== 'struct' && first?.type !== 'struct[]') {
			return undefined;
		}
		const schemas: [string, string][] = [];
		for (const dependency of structRegistry.getDependencies(name)) {
			const schema = structDefinitions.get(dependency);
			if (schema !== undefined) {
				schemas.push([dependency, schema]);
			}
		}
		const bytes = new Uint8Array(size);
		const input = this.index.bytes;
		for (let i = 0; i < length; i++) {
			const start = payloadOffsets[i]!;
			const offset = offsets[i]!;
			bytes.set(input.subarray(start, start + (offsets[i + 1]! - offset)), offset);
		}
		return fromTransfer({ timestamps, length, structs: { bytes, offsets, name, schemas, stride, array } });
	}

	private readWhere(
		include: (kind: NonNullable<Target>['kind'], name: string) => boolean,
		packStructs = false,
	): string[] {
		const names = new Set<string>();
		this.unread = this.unread.filter(({ entry, target, repeated }) => {
			if (!include(target.kind, entry.name)) {
				return true;
			}
			const packed = packStructs && !repeated && target.kind === 'samples' ? this.packStruct(entry) : undefined;
			const numbers = !packed && target.kind === 'samples' ? this.decoder.decodeNumbers(entry) : undefined;
			if (target.kind === 'samples' && packed) {
				target.entry.samples = packed;
			} else if (target.kind === 'samples' && numbers !== undefined) {
				// The index's timestamps aren't used again
				this.accumulator.addNumbers(target.entry, entry.timestamps, numbers, entry.length);
			} else {
				for (let i = 0; i < entry.length; i++) {
					const record = this.decoder.decode(entry, i);
					if (record) {
						this.accumulator.addData(target, record);
						if (target.kind === 'schema' && record.type === 'string') {
							this.structDefinitions.set(target.name, record.payload);
						}
					}
				}
			}
			this.readRecords += entry.length;
			const percent = Math.floor((this.readRecords / this.records) * 100);
			if (percent !== this.percent) {
				this.percent = percent;
				this.onProgress(percent / 100);
			}
			if (target.kind === 'samples' || target.kind === 'embedded') {
				names.add(entry.name);
			}
			return false;
		});
		this.accumulator.finishEntries([...names].map((name) => this.accumulator.entries.get(name)!));
		return [...names];
	}

	/** Read every entry that wasn't read yet */
	finish(): ParsedLog {
		// The entries a dashboard uses were decoded in the worker by `read()`. Everything else can stay packed.
		this.readWhere(() => true, true);
		// Entries whose last start wasn't finished
		const last = new Map<number, IndexedEntry>();
		for (const entry of this.index.entries) {
			last.set(entry.entryId, entry);
		}
		return {
			...this.accumulator.finish(this.index.bytes.byteLength, this.index.bytesRead),
			openEntryIds: [...last.values()].filter((entry) => !entry.finished).map((entry) => entry.entryId),
		};
	}
}

/**
 * Read every entry of a WPILOG file. Throws if it isn't a WPILOG file, or if it's so damaged that none of its entries
 * could be read. See `LogReader` for `onProgress`.
 */
export function parseLog(bytes: Uint8Array, onProgress: (progress: number) => void, onRecord?: OnRecord): ParsedLog {
	return new LogReader(bytes, onProgress, onRecord).finish();
}
