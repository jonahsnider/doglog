import { LogAccumulator, type ParsedLog } from '@/data/parse-log';
import { readTimestamp, readVarInt, StreamingRecordDecoder } from '@/data/stream-log-decoder';

// ASCII bytes for "WPILOG"
const wpilogMagic = [0x57, 0x50, 0x49, 0x4c, 0x4f, 0x47] as const;

/**
 * Incremental WPILOG parser that consumes arbitrary byte chunks as they download, keeping only the partial record
 * spanning chunk boundaries in memory. Produces the same `ParsedLog` output and damaged-tail handling as `parseLog`.
 */
export class StreamingLogParser {
	private readonly accumulator = new LogAccumulator();
	private readonly decoder = new StreamingRecordDecoder();
	private carry: Uint8Array = new Uint8Array(0);
	private headerParsed = false;
	private damaged = false;
	private damageError: unknown;
	private totalBytes = 0;
	private readBytes = 0;

	push(chunk: Uint8Array): void {
		if (chunk.byteLength === 0) {
			return;
		}
		this.totalBytes += chunk.byteLength;
		if (this.damaged) {
			return;
		}

		let buffer: Uint8Array;
		if (this.carry.byteLength === 0) {
			buffer = chunk;
		} else {
			buffer = new Uint8Array(this.carry.byteLength + chunk.byteLength);
			buffer.set(this.carry);
			buffer.set(chunk, this.carry.byteLength);
			this.carry = new Uint8Array(0);
		}

		const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
		let offset = 0;

		if (!this.headerParsed) {
			if (buffer.byteLength < 12) {
				this.carry = buffer.slice();
				return;
			}
			for (let i = 0; i < wpilogMagic.length; i++) {
				if (buffer[i] !== wpilogMagic[i]) {
					this.damaged = true;
					this.damageError = new Error("It isn't a WPILOG file.");
					return;
				}
			}
			const recordsOffset = 12 + view.getUint32(8, true);
			if (recordsOffset > buffer.byteLength) {
				this.carry = buffer.slice();
				return;
			}
			this.headerParsed = true;
			offset = recordsOffset;
			this.readBytes = recordsOffset;
		}

		const total = buffer.byteLength;
		try {
			while (offset < total) {
				const recordStart = offset;
				const bitfield = view.getUint8(offset++);
				const entryIdLength = 1 + (bitfield & 3);
				const payloadSizeLength = 1 + ((bitfield >> 2) & 3);
				const timestampLength = 1 + ((bitfield >> 4) & 7);
				if (offset + entryIdLength + payloadSizeLength + timestampLength > total) {
					offset = recordStart;
					break;
				}
				const entryId = readVarInt(view, offset, entryIdLength);
				offset += entryIdLength;
				const payloadSize = readVarInt(view, offset, payloadSizeLength);
				offset += payloadSizeLength;
				const timestamp = readTimestamp(view, offset, timestampLength);
				offset += timestampLength;
				if (offset + payloadSize > total) {
					offset = recordStart;
					break;
				}

				const payloadOffset = offset;
				offset += payloadSize;
				this.decoder.decode(entryId, timestamp, buffer, view, payloadOffset, payloadSize, (record) => {
					this.accumulator.addRecord(record);
				});
				this.readBytes += offset - recordStart;
			}
		} catch (error) {
			this.damaged = true;
			this.damageError = error;
			this.carry = new Uint8Array(0);
			return;
		}

		if (offset < total) {
			this.carry = buffer.slice(offset);
		}
	}

	finish(): ParsedLog {
		if (!this.headerParsed) {
			throw this.damageError instanceof Error ? this.damageError : new Error("It isn't a WPILOG file.");
		}
		if (this.damaged && this.accumulator.entries.size === 0) {
			throw new Error("It's damaged, and none of it could be read.", { cause: this.damageError });
		}
		return this.accumulator.finish(this.totalBytes, this.readBytes);
	}
}
