import { LogLevel, NetworkTables, type NetworkTablesTypes } from '@ntcore-ts/client';
import { StructRegistry } from 'wpilib-struct';
import type { DataSet } from '@/data/data-set';
import { type Entry, liveTime, parseMetadata } from '@/data/data-store';
import { isSchemaEntry, isStudioEntry, normalizeEntryName, type Value } from '@/data/samples';

/**
 * `connecting` until the first connection is made, `reconnecting` while trying again after it dropped, and `disconnected`
 * once the user disconnects
 */
export type LiveStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

NetworkTables.setLogLevel(LogLevel.WARN);

const structSchemaPrefix = '/.schema/struct:';

/** Called by our @ntcore-ts/client patch when topic properties change. `null` values remove a property. */
type PropertiesListener = (params: { name: string; update: Record<string, unknown> }) => void;
const textDecoder = new TextDecoder();

/**
 * Connect to an NT4 server and add every topic and value to `data`, recording when the connection drops.
 * Reconnects automatically and keeps adding to the same history. Returns a function that disconnects.
 */
export function connectLive(
	host: string,
	data: DataSet,
	onStatus: (status: Exclude<LiveStatus, 'disconnected'>) => void,
): () => void {
	// Shared with log sync when it watches the same robot
	const nt = NetworkTables.getInstanceByURI(host);
	nt.retain();
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

	const toValue = (entry: Entry, value: NetworkTablesTypes, timestamp: number): Value | undefined => {
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

	// Notified right away, since shared dashboards might have connected to the same server already
	const removeConnectionListener = nt.addRobotConnectionListener((isConnected) => {
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
	}, true);

	const topic = nt.getPrefixTopic('/');

	// Prefix subscribers aren't told about announcements, wrap it so topics without values are listed too
	const announce = topic.announce.bind(topic);
	topic.announce = (params) => {
		announce(params);
		const name = normalizeEntryName(params.name);
		if (!closed && !isSchemaEntry(name) && !isStudioEntry(name)) {
			data.addEntry(name, params.type, undefined, parseMetadata(params.properties));
		}
	};
	(topic as typeof topic & { onProperties?: PropertiesListener }).onProperties = ({ name, update }) => {
		const entry = data.entries.get(normalizeEntryName(name));
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
	};

	const subscription = topic.subscribe(
		(value, params) => {
			if (closed || value === null) {
				return;
			}

			const name = normalizeEntryName(params.name);
			if (isStudioEntry(name) || isSchemaEntry(name)) {
				return;
			}

			// Set right before subscribers are called
			const serverTime = topic.lastChangedTime ?? 0;
			const now = liveTime();
			clockOffset = Math.min(clockOffset ?? Infinity, now - serverTime);
			// Values that changed before this connection (sent when subscribing) are placed at the connection time
			const timestamp = Math.max(serverTime + clockOffset, connectedAt);

			const entry = data.addEntry(name, params.type);
			const decoded = toValue(entry, value, timestamp);
			if (decoded === undefined) {
				return;
			}

			data.addSample(entry, timestamp, decoded);
		},
		{ all: true, periodic: 0.02 },
	);

	// The NT4 client subscribes to struct schemas itself, so the server doesn't send them to subscriptions made after it
	// connected, ex. when shared dashboards connected first or after reconnecting. Its cached schemas are replayed instead.
	const schemaTopic = nt.getPrefixTopic(structSchemaPrefix);
	const schemaSubscription = schemaTopic.subscribe(
		(value, params) => {
			if (!closed && value !== null) {
				registerStructSchema(params.name, value instanceof Uint8Array ? textDecoder.decode(value) : String(value));
			}
		},
		{ all: true, immediateNotify: true },
	);

	return () => {
		closed = true;
		if (connected) {
			data.disconnect(liveTime());
		}
		removeConnectionListener();
		topic.unsubscribe(subscription, true);
		schemaTopic.unsubscribe(schemaSubscription, true);
		nt.release();
	};
}
