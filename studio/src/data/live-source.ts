import { StructRegistry } from 'wpilib-struct';
import type { DataSet } from '@/data/data-set';
import { type Entry, liveTime, parseMetadata } from '@/data/data-store';
import { setLiveConnection } from '@/data/live-connection';
import type { LiveRecording } from '@/data/recording';
import { isSchemaEntry, isStudioEntry, normalizeEntryName, type Value } from '@/data/samples';
import type { NtClient, NtValue } from '@/nt/client';

/**
 * `connecting` until the first connection is made, `reconnecting` while trying again after it dropped, and `disconnected`
 * once the user disconnects
 */
export type LiveStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

const structSchemaPrefix = '/.schema/struct:';
/** How long (µs) the NT4 client goes without hearing from the server before it drops the connection */
const idleTimeout = 3_000_000;
const textDecoder = new TextDecoder();

/**
 * Add every topic and value from `nt` to `data` and `recording`, noting when the connection drops.
 * Reconnects automatically and keeps adding to the same history. Returns a function that disconnects and closes `nt`.
 */
export function connectLive(
	nt: NtClient,
	data: DataSet,
	recording: LiveRecording,
	onStatus: (status: Exclude<LiveStatus, 'disconnected'>) => void,
): () => void {
	setLiveConnection(nt);
	const structs = new StructRegistry();
	// Struct values that arrived before their schema
	let pendingStructs: { entry: Entry; timestamp: number; bytes: Uint8Array }[] = [];
	let closed = false;
	let connected = false;
	let connectedAt = 0;
	// Studio's clock minus the server's for the current connection
	let clockOffset = 0;
	// When the newest value received was sent, on Studio's clock
	let newestValueAt = 0;

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

		const wasConnected = connected;
		connected = isConnected;
		if (connected) {
			connectedAt = liveTime();
			// Synced by the NT4 client before it says it's connected
			const serverTime = nt.serverTime() ?? connectedAt;
			clockOffset = connectedAt - serverTime;
			if (data.start === undefined) {
				data.setStartTime(connectedAt);
			}
			data.connect(connectedAt);
			recording.record({ type: 'connected', liveTime: connectedAt, serverTime });
		} else if (wasConnected) {
			// The connection is dropped a while after the server went quiet, which is when it really dropped. That's the
			// newest value's time while the robot sends data, and at most the idle timeout earlier otherwise.
			const droppedAt = Math.max(connectedAt, newestValueAt, liveTime() - idleTimeout);
			data.disconnect(droppedAt);
			recording.record({ type: 'status', status: 'reconnecting', liveTime: droppedAt });
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
				if (closed || isStudioEntry(name)) {
					return;
				}
				recording.record({ type: 'announce', name, topicType: type, properties, liveTime: liveTime() });
				if (!isSchemaEntry(name)) {
					data.addEntry(name, type, undefined, parseMetadata(properties));
				}
			},
			properties: (topicName, update) => {
				const name = normalizeEntryName(topicName);
				if (closed || isStudioEntry(name)) {
					return;
				}
				recording.record({ type: 'properties', name, update, liveTime: liveTime() });
				const entry = data.entries.get(name);
				if (!entry) {
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
				if (closed || isStudioEntry(name)) {
					return;
				}
				recording.record({ type: 'value', name, topicType: type, value, serverTime });
				if (isSchemaEntry(name)) {
					return;
				}

				// Values that changed before this connection (sent when subscribing) are placed at the connection time
				const timestamp = Math.max(serverTime + clockOffset, connectedAt);
				newestValueAt = Math.max(newestValueAt, timestamp);

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
			value: (name, type, value, serverTime) => {
				if (!closed) {
					recording.record({ type: 'value', name: normalizeEntryName(name), topicType: type, value, serverTime });
					registerStructSchema(name, value instanceof Uint8Array ? textDecoder.decode(value) : String(value));
				}
			},
		},
	);

	return () => {
		closed = true;
		setLiveConnection(undefined);
		if (connected) {
			data.disconnect(liveTime());
		}
		// Unless the session is replaced or cleared, which deletes its recording, the user disconnected
		recording.record({ type: 'status', status: 'disconnected', liveTime: liveTime() });
		nt.close();
	};
}
