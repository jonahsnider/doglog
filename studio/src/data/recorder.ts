// How Studio records live sessions to WPILOG files, see `@/data/recording` for where they're stored and
// `@/data/read-recording` for reading them back
import type { DataLogWriter } from 'wpilog-parser';
import type { NtValue } from '@/nt/client';

/** Entries Studio adds to a recording, to rebuild the live session from it */
export const recordingPrefix = '/DogLogStudio/Recording/';
export const hiddenEntries = {
	/** The server the session connected to, written once */
	host: `${recordingPrefix}Host`,
	/** `connected`, `reconnecting` once the connection dropped, or `disconnected` once the user disconnected */
	status: `${recordingPrefix}Status`,
	/** Studio's clock (µs since the Unix epoch) when each connection was made */
	studioTime: `${recordingPrefix}StudioTime`,
	/** The server's clock (µs) when each connection was made */
	serverTime: `${recordingPrefix}ServerTime`,
};

const structSchemaPrefix = '/.schema/struct:';
const protobufSchemaPrefix = '/.schema/proto:';
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/** A server clock that jumps more than this between connections was reset, ex. the robot was power cycled */
const resetThreshold = 1_000_000;

/** What `Recorder` writes. Times are µs, `liveTime` on Studio's clock and `serverTime` on the server's. */
export type RecordingEvent =
	| { type: 'connected'; liveTime: number; serverTime: number }
	| { type: 'status'; status: 'reconnecting' | 'disconnected'; liveTime: number }
	| { type: 'announce'; name: string; topicType: string; properties: Record<string, unknown>; liveTime: number }
	| { type: 'properties'; name: string; update: Record<string, unknown>; liveTime: number }
	| { type: 'value'; name: string; topicType: string; value: NtValue; serverTime: number };

/** How the recording's clock relates to the others at the latest connection: `shift` from the server's, and `offset` from Studio's to the server's */
export type RecordingClock = { shift: number; offset: number };

export class Recorder {
	private readonly writer: DataLogWriter;
	private readonly host: string;
	private readonly entries = new Map<string, { id: number; type: string; properties: Record<string, unknown> }>();
	// Protobuf schema topics whose value was written
	private readonly protobufSchemas = new Set<string>();
	private clock: RecordingClock | undefined;
	/** When the current connection was made, on the recording's clock */
	private connectedAt: number | undefined;

	/** `clock` continues a recording, see `RestoredRecording` */
	constructor(writer: DataLogWriter, host: string, clock?: RecordingClock) {
		this.writer = writer;
		this.host = host;
		this.clock = clock;
	}

	record(event: RecordingEvent): void {
		if (event.type === 'connected') {
			this.connect(event.liveTime, event.serverTime);
			return;
		}
		const { clock } = this;
		if (clock === undefined) {
			return;
		}
		switch (event.type) {
			case 'status':
				this.connectedAt = undefined;
				this.appendHidden(hiddenEntries.status, 'string', event.status, this.fromLive(event.liveTime));
				break;
			case 'announce':
				if (!event.name.startsWith(structSchemaPrefix)) {
					this.entry(event.name, event.topicType, event.properties, this.fromLive(event.liveTime));
				}
				break;
			case 'properties': {
				const entry = this.entries.get(event.name);
				if (entry) {
					entry.properties = { ...entry.properties, ...event.update };
					for (const [key, value] of Object.entries(event.update)) {
						if (value === null) {
							delete entry.properties[key];
						}
					}
					this.writer.setMetadata(entry.id, JSON.stringify(entry.properties), this.fromLive(event.liveTime));
				}
				break;
			}
			case 'value': {
				// Values cached before the server knew when they changed are sent with time 0
				const time =
					event.serverTime === 0 && this.connectedAt !== undefined
						? this.connectedAt
						: Math.round(event.serverTime + clock.shift);
				// Schemas are received by more than one subscription, and a schema file never changes
				if (event.name.startsWith(protobufSchemaPrefix)) {
					if (this.protobufSchemas.has(event.name)) {
						return;
					}
					this.protobufSchemas.add(event.name);
				}
				if (event.name.startsWith(structSchemaPrefix)) {
					const schema = event.value instanceof Uint8Array ? textDecoder.decode(event.value) : String(event.value);
					try {
						// Does nothing for a schema it already has
						this.writer.addStructSchema(event.name.slice(structSchemaPrefix.length), schema, time);
					} catch {
						// Invalid schema
					}
					return;
				}
				const entry = this.entry(event.name, event.topicType, undefined, time);
				this.append(entry.id, entry.type, event.value, time);
				break;
			}
		}
	}

	private connect(liveTime: number, serverTime: number): void {
		const offset = liveTime - serverTime;
		const previous = this.clock;
		let shift = previous?.shift ?? 0;
		if (previous !== undefined && Math.abs(offset - previous.offset) > resetThreshold) {
			shift += offset - previous.offset;
		}
		this.clock = { shift, offset };
		const time = Math.round(serverTime + shift);
		this.connectedAt = time;
		if (previous === undefined) {
			this.appendHidden(hiddenEntries.host, 'string', this.host, time);
		}
		this.appendHidden(hiddenEntries.status, 'string', 'connected', time);
		this.appendHidden(hiddenEntries.studioTime, 'int64', Math.round(liveTime), time);
		this.appendHidden(hiddenEntries.serverTime, 'int64', Math.round(serverTime), time);
	}

	/** The recording's time for a time on Studio's clock */
	private fromLive(liveTime: number): number {
		const { shift, offset } = this.clock!;
		return Math.round(liveTime - offset + shift);
	}

	/** The entry for a topic, started again if its type changed */
	private entry(name: string, topicType: string, properties: Record<string, unknown> | undefined, time: number) {
		// WPILOG names NT4's integers `int64`
		const type = topicType === 'int' ? 'int64' : topicType === 'int[]' ? 'int64[]' : topicType;
		const existing = this.entries.get(name);
		if (existing?.type === type) {
			if (properties !== undefined && JSON.stringify(properties) !== JSON.stringify(existing.properties)) {
				existing.properties = properties;
				this.writer.setMetadata(existing.id, JSON.stringify(properties), time);
			}
			return existing;
		}
		if (existing) {
			this.writer.finish(existing.id, time);
		}
		const entry = {
			id: this.writer.start(name, type, JSON.stringify(properties ?? {}), time),
			type,
			properties: properties ?? {},
		};
		this.entries.set(name, entry);
		return entry;
	}

	private append(id: number, type: string, value: NtValue, time: number): void {
		try {
			if (value instanceof Uint8Array || type === 'json') {
				// wpilog-parser only appends structs it encodes itself, the server's bytes are written as they arrived
				// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- See above
				(this.writer as unknown as WriterInternals).appendBytes(
					id,
					time,
					value instanceof Uint8Array ? value : textEncoder.encode(String(value)),
				);
			} else {
				this.writer.append(id, value, time);
			}
		} catch {
			// A value that doesn't match its topic's type
		}
	}

	private appendHidden(name: string, type: string, value: string | number, time: number): void {
		this.append(this.entry(name, type, undefined, time).id, type, value, time);
	}
}

type WriterInternals = { appendBytes(entryId: number, timestamp: number, payload: Uint8Array): void };

/**
 * Finish records for `entryIds`, so a writer that starts its entry IDs over can continue a recording. Only the IDs of
 * entries started and not finished are needed.
 */
export function finishRecords(entryIds: readonly number[], timestamp: number): Uint8Array {
	// Each has a 1 byte entry ID (0, control records) and payload size, and an 8 byte timestamp
	const recordLength = 16;
	const bytes = new Uint8Array(entryIds.length * recordLength);
	const view = new DataView(bytes.buffer);
	for (const [index, entryId] of entryIds.entries()) {
		const at = index * recordLength;
		bytes.set([0x70, 0, 5], at);
		view.setBigInt64(at + 3, BigInt(timestamp), true);
		// Finish
		bytes[at + 11] = 1;
		view.setUint32(at + 12, entryId, true);
	}
	return bytes;
}
