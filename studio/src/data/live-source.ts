import { StructRegistry } from 'wpilib-struct';
import type { DataSet } from '@/data/data-set';
import { type Entry, liveTime, parseMetadata } from '@/data/data-store';
import { isSchemaEntry, isStudioEntry, normalizeEntryName, type Value } from '@/data/samples';
import type { NtClient, NtValue } from '@/nt/client';

/**
 * `connecting` until the first connection is made, `reconnecting` while trying again after it dropped, and `disconnected`
 * once the user disconnects
 */
export type LiveStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

const structSchemaPrefix = '/.schema/struct:';
const textDecoder = new TextDecoder();

/**
 * Add every topic and value from `nt` to `data`, recording when the connection drops.
 * Reconnects automatically and keeps adding to the same history. Returns a function that disconnects and closes `nt`.
 */
export function connectLive(
	nt: NtClient,
	data: DataSet,
	onStatus: (status: Exclude<LiveStatus, 'disconnected'>) => void,
): () => void {
	const structs = new StructRegistry();
	// Struct values that arrived before their schema
	let pendingStructs: { entry: Entry; timestamp: number; bytes: Uint8Array }[] = [];
	let closed = false;
	let connected = false;
	let connectedAt = 0;
	// Client clock minus server clock for the current connection. The smallest difference seen is the least delayed value.
	let clockOffset: number | undefined;

	const decodeStruct = (entry: Entry, bytes: Uint8Array): Value | string => {
		const structName = entry.type.slice('struct:'.length);
		return entry.kind === 'struct[]'
			? structs.decodeArray(structName.slice(0, -'[]'.length), bytes)
			: structs.decode(structName, bytes);
	};

	const toValue = (entry: Entry, value: NtValue, timestamp: number): Value | undefined => {
		switch (entry.kind) {
			case 'unsupported':
				return undefined;
			case 'string':
				return value instanceof Uint8Array ? textDecoder.decode(value) : String(value);
			case 'struct':
			case 'struct[]': {
				if (!(value instanceof Uint8Array)) {
					return undefined;
				}
				const decoded = decodeStruct(entry, value);
				if (typeof decoded === 'string') {
					// Missing schema, decode it once the schema arrives
					pendingStructs.push({ entry, timestamp, bytes: value });
					return undefined;
				}
				return decoded;
			}
			default:
				return value instanceof Uint8Array ? undefined : value;
		}
	};

	const registerStructSchema = (name: string, schema: string): void => {
		const structName = name.slice(structSchemaPrefix.length);
		try {
			structs.register(structName, schema);
		} catch {
			// Invalid schema, values using it stay pending
			return;
		}
		data.addStructSchema(structName, structs.getDefinition(structName));

		pendingStructs = pendingStructs.filter(({ entry, timestamp, bytes }) => {
			const decoded = decodeStruct(entry, bytes);
			if (typeof decoded === 'string') {
				return true;
			}
			data.addSample(entry, timestamp, decoded);
			return false;
		});
	};

	// Notified right away, since other windows or shared dashboards might have connected to the same server already
	nt.onConnectedChange((isConnected) => {
		if (closed) {
			return;
		}

		connected = isConnected;
		if (connected) {
			connectedAt = liveTime();
			clockOffset = undefined;
			if (data.start === undefined) {
				data.setStartTime(connectedAt);
			}
			data.connect(connectedAt);
		} else if (data.start !== undefined) {
			data.disconnect(liveTime());
		}

		// Data from an earlier connection means this is reconnecting, ex. after the user disconnected
		onStatus(connected ? 'connected' : data.start === undefined ? 'connecting' : 'reconnecting');
	});

	nt.subscribe(
		'/',
		{ all: true, periodic: 0.02 },
		{
			// Topics without values are listed too
			announce: ({ name: topicName, type, properties }) => {
				const name = normalizeEntryName(topicName);
				if (!closed && !isSchemaEntry(name) && !isStudioEntry(name)) {
					data.addEntry(name, type, undefined, parseMetadata(properties));
				}
			},
			properties: (topicName, update) => {
				const entry = data.entries.get(normalizeEntryName(topicName));
				if (closed || !entry) {
					return;
				}
				const metadata = { ...entry.metadata, ...parseMetadata(update) };
				for (const [key, value] of Object.entries(update)) {
					if (value === null) {
						delete metadata[key];
					}
				}
				data.setMetadata(entry, metadata);
			},
			value: (topicName, type, value, serverTime) => {
				const name = normalizeEntryName(topicName);
				if (closed || isStudioEntry(name) || isSchemaEntry(name)) {
					return;
				}

				const now = liveTime();
				clockOffset = Math.min(clockOffset ?? Infinity, now - serverTime);
				// Values that changed before this connection (sent when subscribing) are placed at the connection time
				const timestamp = Math.max(serverTime + clockOffset, connectedAt);

				const entry = data.addEntry(name, type);
				const decoded = toValue(entry, value, timestamp);
				if (decoded === undefined) {
					return;
				}

				data.addSample(entry, timestamp, decoded);
			},
		},
	);

	nt.subscribe(
		structSchemaPrefix,
		{ all: true },
		{
			value: (name, _type, value) => {
				if (!closed) {
					registerStructSchema(name, value instanceof Uint8Array ? textDecoder.decode(value) : String(value));
				}
			},
		},
	);

	return () => {
		closed = true;
		if (connected) {
			data.disconnect(liveTime());
		}
		nt.close();
	};
}
