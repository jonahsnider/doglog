// Parses WPILOG files off the main thread so the UI stays responsive while large logs load
import { type DataRecord, isDataRecord, parseDataLog } from 'wpilog-parser';
import { normalizeEntryName, Samples, type Value } from '@/data/samples';

/** Messages posted by the worker, in order: one `entry` per entry, then `done` or `error` */
export type LogWorkerMessage =
	| { type: 'entry'; name: string; entryType: string; timestamps: Float64Array<ArrayBuffer>; values: Value[] }
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

/** Whether the last record ends exactly at the end of the file, the parser silently stops at a cut off record */
function endsCleanly(bytes: Uint8Array): boolean {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	let offset = 12 + view.getUint32(8, true);

	while (offset < bytes.byteLength) {
		const bitfield = view.getUint8(offset);
		const entryIdLength = (bitfield & 0b11) + 1;
		const payloadSizeLength = ((bitfield >> 2) & 0b11) + 1;
		const timestampLength = ((bitfield >> 4) & 0b111) + 1;
		const headerLength = 1 + entryIdLength + payloadSizeLength + timestampLength;
		if (offset + headerLength > bytes.byteLength) {
			return false;
		}

		let payloadSize = 0;
		for (let i = 0; i < payloadSizeLength; i++) {
			payloadSize += view.getUint8(offset + 1 + entryIdLength + i) * 2 ** (8 * i);
		}
		offset += headerLength + payloadSize;
	}

	return offset === bytes.byteLength;
}

function parse(bytes: Uint8Array): void {
	const entries = new Map<string, { type: string; samples: Samples }>();
	let start: number | undefined;
	let end: number | undefined;
	let damaged = false;

	try {
		for (const record of parseDataLog(bytes)) {
			if (!isDataRecord(record)) {
				const { payload } = record;
				// Only start records define entries
				if (payload.controlRecordType !== 0) {
					continue;
				}
				const name = normalizeEntryName(payload.entryName);
				if (entries.get(name)?.type !== payload.entryType) {
					entries.set(name, { type: payload.entryType, samples: new Samples() });
				}
				continue;
			}

			const entry = entries.get(record.name);
			if (!entry) {
				continue;
			}
			const value = toValue(record, entry.type);
			if (value === undefined) {
				continue;
			}

			const timestamp = Number(record.timestamp);
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
	damaged ||= !endsCleanly(bytes);

	for (const [name, { type, samples }] of entries) {
		const message: LogWorkerMessage = {
			type: 'entry',
			name,
			entryType: type,
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
