import { LogLevel, NetworkTables, type NetworkTablesTypes } from '@ntcore-ts/client';
import { StructRegistry } from 'wpilib-struct';
import { addEntry, addSample, type Entry, getEntry, parseMetadata, setMetadata, setStartTime } from '@/data/data-store';
import { isSchemaEntry, isStudioEntry, normalizeEntryName, type Value } from '@/data/samples';

export type LiveStatus = 'connecting' | 'connected' | 'disconnected';

NetworkTables.setLogLevel(LogLevel.WARN);

const structSchemaPrefix = '/.schema/struct:';

/** Called by our @ntcore-ts/client patch when topic properties change. `null` values remove a property. */
type PropertiesListener = (params: { name: string; update: Record<string, unknown> }) => void;
const textDecoder = new TextDecoder();

/** Live sample timestamps use this clock (microseconds), so history stays in order when the robot reboots and its clock resets */
function nowMicros(): number {
	return (performance.timeOrigin + performance.now()) * 1000;
}

/**
 * Connect to an NT4 server and add every topic and value to the data store.
 * Reconnects automatically and keeps adding to the same history. Returns a function that disconnects.
 */
export function connectLive(host: string, onStatus: (status: LiveStatus) => void): () => void {
	// Shared with log sync when it watches the same robot
	const nt = NetworkTables.getInstanceByURI(host);
	nt.retain();
	const structs = new StructRegistry();
	// Struct values that arrived before their schema
	let pendingStructs: { entry: Entry; timestamp: number; bytes: Uint8Array }[] = [];
	let closed = false;
	let everConnected = false;
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
		try {
			structs.register(name.slice(structSchemaPrefix.length), schema);
		} catch {
			// Invalid schema, values using it stay pending
			return;
		}

		pendingStructs = pendingStructs.filter(({ entry, timestamp, bytes }) => {
			const decoded = decodeStruct(entry, bytes);
			if (typeof decoded === 'string') {
				return true;
			}
			addSample(entry, timestamp, decoded);
			return false;
		});
	};

	const removeConnectionListener = nt.addRobotConnectionListener((connected) => {
		if (closed) {
			return;
		}

		if (connected) {
			connectedAt = nowMicros();
			clockOffset = undefined;
			if (!everConnected) {
				everConnected = true;
				setStartTime(connectedAt);
			}
		}

		onStatus(connected ? 'connected' : everConnected ? 'disconnected' : 'connecting');
	});

	const topic = nt.getPrefixTopic('/');

	// Prefix subscribers aren't told about announcements, wrap it so topics without values are listed too
	const announce = topic.announce.bind(topic);
	topic.announce = (params) => {
		announce(params);
		const name = normalizeEntryName(params.name);
		if (!closed && !isSchemaEntry(name) && !isStudioEntry(name)) {
			addEntry(name, params.type, undefined, parseMetadata(params.properties));
		}
	};
	(topic as typeof topic & { onProperties?: PropertiesListener }).onProperties = ({ name, update }) => {
		const entry = getEntry(normalizeEntryName(name));
		if (closed || !entry) {
			return;
		}
		const metadata = { ...entry.metadata, ...parseMetadata(update) };
		for (const [key, value] of Object.entries(update)) {
			if (value === null) {
				delete metadata[key];
			}
		}
		setMetadata(entry, metadata);
	};

	const subscription = topic.subscribe(
		(value, params) => {
			if (closed || value === null) {
				return;
			}

			const name = normalizeEntryName(params.name);
			if (isStudioEntry(name)) {
				return;
			}
			if (isSchemaEntry(name)) {
				if (params.type === 'structschema' && name.startsWith(structSchemaPrefix)) {
					registerStructSchema(name, value instanceof Uint8Array ? textDecoder.decode(value) : String(value));
				}
				return;
			}

			// Set right before subscribers are called
			const serverTime = topic.lastChangedTime ?? 0;
			const now = nowMicros();
			clockOffset = Math.min(clockOffset ?? Infinity, now - serverTime);
			// Values that changed before this connection (sent when subscribing) are placed at the connection time
			const timestamp = Math.max(serverTime + clockOffset, connectedAt);

			const entry = addEntry(name, params.type);
			const decoded = toValue(entry, value, timestamp);
			if (decoded === undefined) {
				return;
			}

			addSample(entry, timestamp, decoded);
		},
		{ all: true, periodic: 0.02 },
	);

	onStatus('connecting');

	return () => {
		closed = true;
		removeConnectionListener();
		topic.unsubscribe(subscription, true);
		nt.release();
	};
}
