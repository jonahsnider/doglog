import { StructDependencyGraph, StructRegistry } from 'wpilib-struct';
import {
	type CatalogEntry,
	type ControlRecordPayload,
	ControlRecordType,
	type DecodedRecord,
	RecordType,
} from 'wpilog-parser';
import { normalizeEntryName } from '@/data/samples';

const textDecoder = new TextDecoder();
const structPrefix = 'struct:';
const structArraySuffix = '[]';
const structSchemaPrefix = '/.schema/struct:';

type QueuedStructRecord = {
	entry: CatalogEntry;
	timestamp: number;
	payload: Uint8Array;
};

export function readVarInt(view: DataView, offset: number, length: number): number {
	switch (length) {
		case 1:
			return view.getUint8(offset);
		case 2:
			return view.getUint16(offset, true);
		case 3:
			return (view.getUint8(offset + 2) << 16) | (view.getUint8(offset + 1) << 8) | view.getUint8(offset);
		case 4:
			return view.getUint32(offset, true);
		default:
			throw new RangeError(`Invalid varint length ${length}`);
	}
}

export function readTimestamp(view: DataView, offset: number, length: number): number {
	switch (length) {
		case 1:
			return view.getUint8(offset);
		case 2:
			return view.getUint16(offset, true);
		case 3:
			return view.getUint16(offset, true) + view.getUint8(offset + 2) * 2 ** 16;
		case 4:
			return view.getUint32(offset, true);
		case 5:
			return view.getUint32(offset, true) + view.getUint8(offset + 4) * 2 ** 32;
		case 6:
			return view.getUint32(offset, true) + view.getUint16(offset + 4, true) * 2 ** 32;
		case 7:
			return (
				view.getUint32(offset, true) +
				(view.getUint16(offset + 4, true) + view.getUint8(offset + 6) * 2 ** 16) * 2 ** 32
			);
		case 8:
			return view.getUint32(offset, true) + view.getInt32(offset + 4, true) * 2 ** 32;
		default:
			throw new RangeError(`Invalid timestamp length ${length}`);
	}
}

function readLengthPrefixedString(
	bytes: Uint8Array,
	view: DataView,
	offset: number,
): { value: string; nextOffset: number } {
	const length = view.getUint32(offset, true);
	const start = offset + 4;
	const end = start + length;
	if (end > bytes.byteLength) {
		throw new RangeError('Truncated string in record payload');
	}
	return { value: textDecoder.decode(bytes.subarray(start, end)), nextOffset: end };
}

function readControlPayload(bytes: Uint8Array): ControlRecordPayload {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const type = view.getUint8(0);
	switch (type) {
		case ControlRecordType.Start: {
			const entryId = view.getUint32(1, true);
			const entryName = readLengthPrefixedString(bytes, view, 5);
			const entryType = readLengthPrefixedString(bytes, view, entryName.nextOffset);
			const entryMetadata = readLengthPrefixedString(bytes, view, entryType.nextOffset);
			return {
				controlRecordType: type,
				entryId,
				entryName: entryName.value,
				entryType: entryType.value,
				entryMetadata: entryMetadata.value,
			};
		}
		case ControlRecordType.Finish:
			return { controlRecordType: type, entryId: view.getUint32(1, true) };
		case ControlRecordType.SetMetadata: {
			const entryId = view.getUint32(1, true);
			const entryMetadata = readLengthPrefixedString(bytes, view, 5);
			return { controlRecordType: type, entryId, entryMetadata: entryMetadata.value };
		}
		default:
			throw new RangeError(`Invalid control record type ${type}`);
	}
}

function byteToBoolean(byte: number): boolean {
	if (byte === 0) {
		return false;
	}
	if (byte === 1) {
		return true;
	}
	throw new RangeError(`Invalid boolean value ${byte}`);
}

/** Stateful WPILOG record decoder with struct dependency queueing, used by `StreamingLogParser` */
export class StreamingRecordDecoder {
	private readonly entries = new Map<number, CatalogEntry>();
	private readonly structRegistry = new StructRegistry();
	private readonly structGraph = new StructDependencyGraph();
	private readonly queuedStructs = new Map<string, QueuedStructRecord[]>();

	decode(
		entryId: number,
		timestamp: number,
		buffer: Uint8Array,
		view: DataView,
		payloadOffset: number,
		payloadSize: number,
		onRecord: (record: DecodedRecord) => void,
	): void {
		if (entryId === 0) {
			const payload = readControlPayload(buffer.subarray(payloadOffset, payloadOffset + payloadSize));
			this.applyControl(payload);
			onRecord({ entryId, timestamp, type: RecordType.Control, payload });
			return;
		}
		const entry = this.entries.get(entryId);
		if (!entry) {
			throw new RangeError(`No type registered for entry ID ${entryId}`);
		}
		const decoded = this.decodeData(entry, timestamp, buffer, view, payloadOffset, payloadSize);
		if (decoded !== undefined) {
			onRecord(decoded);
		}
		this.flushQueuedStructs(onRecord);
	}

	private applyControl(payload: ControlRecordPayload): void {
		switch (payload.controlRecordType) {
			case ControlRecordType.Start:
				this.entries.set(payload.entryId, {
					entryId: payload.entryId,
					name: normalizeEntryName(payload.entryName),
					type: payload.entryType,
					metadata: payload.entryMetadata,
				});
				break;
			case ControlRecordType.Finish:
				this.entries.delete(payload.entryId);
				break;
			case ControlRecordType.SetMetadata: {
				const existing = this.entries.get(payload.entryId);
				if (existing) {
					this.entries.set(payload.entryId, { ...existing, metadata: payload.entryMetadata });
				}
				break;
			}
		}
	}

	private decodeData(
		entry: CatalogEntry,
		timestamp: number,
		buffer: Uint8Array,
		view: DataView,
		payloadOffset: number,
		payloadSize: number,
	): DecodedRecord | undefined {
		switch (entry.type) {
			case 'boolean':
				return { entry, timestamp, type: RecordType.Boolean, payload: byteToBoolean(view.getUint8(payloadOffset)) };
			case 'int64':
				return { entry, timestamp, type: RecordType.Int64, payload: view.getBigInt64(payloadOffset, true) };
			case 'float':
				return { entry, timestamp, type: RecordType.Float, payload: view.getFloat32(payloadOffset, true) };
			case 'double':
				return { entry, timestamp, type: RecordType.Double, payload: view.getFloat64(payloadOffset, true) };
		}

		const payload = buffer.subarray(payloadOffset, payloadOffset + payloadSize);
		const payloadView = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);

		switch (entry.type) {
			case 'string':
				return { entry, timestamp, type: RecordType.String, payload: textDecoder.decode(payload) };
			case 'boolean[]': {
				const values: boolean[] = [];
				for (let i = 0; i < payload.byteLength; i++) {
					values.push(byteToBoolean(payloadView.getUint8(i)));
				}
				return { entry, timestamp, type: RecordType.BooleanArray, payload: values };
			}
			case 'int64[]': {
				const values: bigint[] = [];
				for (let i = 0; i < payload.byteLength; i += 8) {
					values.push(payloadView.getBigInt64(i, true));
				}
				return { entry, timestamp, type: RecordType.Int64Array, payload: values };
			}
			case 'float[]': {
				const values: number[] = [];
				for (let i = 0; i < payload.byteLength; i += 4) {
					values.push(payloadView.getFloat32(i, true));
				}
				return { entry, timestamp, type: RecordType.FloatArray, payload: values };
			}
			case 'double[]': {
				const values: number[] = [];
				for (let i = 0; i < payload.byteLength; i += 8) {
					values.push(payloadView.getFloat64(i, true));
				}
				return { entry, timestamp, type: RecordType.DoubleArray, payload: values };
			}
			case 'string[]': {
				const values: string[] = [];
				const count = payloadView.getUint32(0, true);
				let pos = 4;
				for (let i = 0; i < count; i++) {
					const read = readLengthPrefixedString(payload, payloadView, pos);
					values.push(read.value);
					pos = read.nextOffset;
				}
				return { entry, timestamp, type: RecordType.StringArray, payload: values };
			}
			case 'structschema': {
				const schemaIndex = entry.name.indexOf(structSchemaPrefix);
				const text = textDecoder.decode(payload);
				if (schemaIndex !== -1) {
					const structName = entry.name.slice(schemaIndex + structSchemaPrefix.length);
					this.structRegistry.register(structName, text);
					const innerNames = this.structRegistry.getDefinition(structName).map((member) => member.value);
					this.structGraph.registerSchema(structName, innerNames);
				}
				return { entry, timestamp, type: RecordType.String, payload: text };
			}
			default:
				return this.decodeStructOrRaw(entry, timestamp, payload);
		}
	}

	private decodeStructOrRaw(entry: CatalogEntry, timestamp: number, payload: Uint8Array): DecodedRecord | undefined {
		if (!entry.type.startsWith(structPrefix)) {
			return { entry, timestamp, type: RecordType.Raw, payload: payload.slice() };
		}
		const structName = entry.type.slice(structPrefix.length);
		if (entry.type.endsWith(structArraySuffix)) {
			const decoded = this.structRegistry.decodeArray(structName.slice(0, -structArraySuffix.length), payload);
			if (typeof decoded === 'string') {
				this.queueStruct(decoded, { entry, timestamp, payload: payload.slice() });
				return undefined;
			}
			return { entry, timestamp, type: RecordType.StructArray, structName, payload: decoded };
		}
		const decoded = this.structRegistry.decode(structName, payload);
		if (typeof decoded === 'string') {
			this.queueStruct(decoded, { entry, timestamp, payload: payload.slice() });
			return undefined;
		}
		return { entry, timestamp, type: RecordType.Struct, structName, payload: decoded };
	}

	private queueStruct(missingSchema: string, record: QueuedStructRecord): void {
		const existing = this.queuedStructs.get(missingSchema);
		if (existing) {
			existing.push(record);
		} else {
			this.queuedStructs.set(missingSchema, [record]);
		}
	}

	private flushQueuedStructs(onRecord: (record: DecodedRecord) => void): void {
		if (this.queuedStructs.size === 0) {
			return;
		}
		for (const structName of this.structGraph.getDecodableStructs()) {
			const queued = this.queuedStructs.get(structName);
			if (!queued) {
				continue;
			}
			this.queuedStructs.delete(structName);
			for (const raw of queued) {
				const decoded = this.decodeStructOrRaw(raw.entry, raw.timestamp, raw.payload);
				if (decoded !== undefined) {
					onRecord(decoded);
				}
			}
		}
	}
}
