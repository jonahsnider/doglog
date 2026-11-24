import {
	LogLevel,
	NetworkTables,
	type NetworkTablesTopic,
	type NetworkTablesTypeInfo,
	NetworkTablesTypeInfos,
} from '@ntcore-ts/client';
import type { NtClient, NtListener, NtPublishType, NtSubscribeOptions, NtTopic, NtValue } from '@/nt/client';
import { liveRate, messenger } from '@/nt/live-rate';

NetworkTables.setLogLevel(LogLevel.WARN);

const typeInfos = {
	raw: NetworkTablesTypeInfos.kUint8Array,
	string: NetworkTablesTypeInfos.kString,
	double: NetworkTablesTypeInfos.kDouble,
	float: NetworkTablesTypeInfos.kFloat,
	int: NetworkTablesTypeInfos.kInteger,
	boolean: NetworkTablesTypeInfos.kBoolean,
	'string[]': NetworkTablesTypeInfos.kStringArray,
	'double[]': NetworkTablesTypeInfos.kDoubleArray,
	'float[]': NetworkTablesTypeInfos.kFloatArray,
	'int[]': NetworkTablesTypeInfos.kIntegerArray,
	'boolean[]': NetworkTablesTypeInfos.kBooleanArray,
} satisfies Record<NtPublishType, NetworkTablesTypeInfo>;

/** One subscription to the server, shared by every listener with the same prefix and options */
type Subscription = {
	listeners: Set<NtListener>;
	/** What the server sent for this subscription, for listeners that join later */
	topics: Map<string, NtTopic>;
	values: Map<string, { type: string; value: NtValue; serverTime: number }>;
	unsubscribe: () => void;
};

type Host = {
	nt: NetworkTables;
	clients: number;
	connected: boolean;
	connectionListeners: Set<(connected: boolean) => void>;
	subscriptions: Map<string, Subscription>;
	liveRate: ReturnType<typeof liveRate>;
	removeConnectionListener: () => void;
};

const hosts = new Map<string, Host>();

function subscribe(host: Host, prefix: string, options: NtSubscribeOptions): Subscription {
	const topic = host.nt.getPrefixTopic(prefix);
	const listeners = new Set<NtListener>();
	const topics = new Map<string, NtTopic>();
	const values: Subscription['values'] = new Map();

	// The library replays subtopic values, but skips a topic whose name equals the prefix.
	for (const other of host.subscriptions.values()) {
		const exact = other.values.get(prefix);
		if (exact) {
			values.set(prefix, exact);
			break;
		}
	}

	const subuid = topic.subscribe(
		(value, { name, type }) => {
			if (value === null) {
				values.delete(name);
				return;
			}
			// The library caches each value and its timestamp before notifying subscribers.
			const sample = topic.getSubtopicValue(name)!;
			values.set(name, { type, value: sample.value, serverTime: sample.serverTime });
			for (const listener of listeners) {
				listener.value?.(name, type, sample.value, sample.serverTime);
			}
		},
		{
			...options,
			// The NT4 client subscribes to some prefixes itself, ex. struct schemas, so use what it received
			immediateNotify: topic.subscribers.size > 0,
		},
	);
	const removeAnnounce = topic.addAnnounceListener(
		({ name, type, properties }) => {
			// The library updates these properties in place; hand listeners a snapshot.
			topics.set(name, { name, type, properties });
			for (const listener of listeners) {
				listener.announce?.({ name, type, properties: { ...properties } });
			}
		},
		{ immediateNotify: true },
	);
	const removeUnannounce = topic.addUnannounceListener(({ name }) => {
		topics.delete(name);
		values.delete(name);
		for (const listener of listeners) {
			listener.unannounce?.(name);
		}
	});
	const removeProperties = topic.addPropertiesListener(({ name, update }) => {
		for (const listener of listeners) {
			listener.properties?.(name, update);
		}
	});
	return {
		listeners,
		topics,
		values,
		unsubscribe: () => {
			removeAnnounce();
			removeUnannounce();
			removeProperties();
			topic.unsubscribe(subuid);
		},
	};
}

/** A client of the NT4 server at `host`, sharing a connection with other clients in this tab or window */
export function openLocalNt(hostname: string, port = 5810): NtClient {
	const key = `${hostname}:${port}`;
	let host = hosts.get(key);
	if (!host) {
		const nt = NetworkTables.getInstanceByURI(hostname, port);
		nt.retain();
		const created: Host = {
			nt,
			clients: 0,
			connected: nt.isRobotConnected(),
			connectionListeners: new Set(),
			subscriptions: new Map(),
			liveRate: liveRate(nt),
			removeConnectionListener: () => {},
		};
		created.removeConnectionListener = nt.addRobotConnectionListener((connected) => {
			created.connected = connected;
			created.liveRate.connectedChange(connected);
			if (!connected) {
				// The server announces everything again after reconnecting
				for (const subscription of created.subscriptions.values()) {
					subscription.topics.clear();
					subscription.values.clear();
				}
			}
			for (const listener of created.connectionListeners) {
				listener(connected);
			}
		});
		hosts.set(key, created);
		host = created;
	}
	host.clients++;
	const { nt } = host;

	let closed = false;
	const connectionListeners = new Set<(connected: boolean) => void>();
	const unsubscribes = new Set<() => void>();
	const published = new Map<string, NetworkTablesTopic<NtValue>>();

	const client: NtClient = {
		isConnected: () => host.connected,
		// Connection listeners are only called once the client synced its clock with the server's
		serverTime: () => {
			if (!host.connected) {
				return undefined;
			}
			return messenger(nt).socket.getServerTime();
		},
		onConnectedChange(listener) {
			connectionListeners.add(listener);
			host.connectionListeners.add(listener);
			queueMicrotask(() => {
				if (connectionListeners.has(listener)) {
					listener(host.connected);
				}
			});
			return () => {
				connectionListeners.delete(listener);
				host.connectionListeners.delete(listener);
			};
		},
		subscribe(prefix, options, listener) {
			const subscriptionKey = JSON.stringify([prefix, options.all ?? false, options.periodic]);
			let subscription = host.subscriptions.get(subscriptionKey);
			if (!subscription) {
				subscription = subscribe(host, prefix, options);
				host.subscriptions.set(subscriptionKey, subscription);
			}
			const joined = subscription;
			joined.listeners.add(listener);
			// After the connection state, which is also sent on a microtask
			queueMicrotask(() => {
				if (!joined.listeners.has(listener)) {
					return;
				}
				for (const announced of joined.topics.values()) {
					listener.announce?.({ ...announced, properties: { ...announced.properties } });
				}
				for (const [name, { type, value, serverTime }] of joined.values) {
					listener.value?.(name, type, value, serverTime);
				}
			});

			const unsubscribe = () => {
				unsubscribes.delete(unsubscribe);
				if (joined.listeners.delete(listener) && joined.listeners.size === 0) {
					joined.unsubscribe();
					host.subscriptions.delete(subscriptionKey);
				}
			};
			unsubscribes.add(unsubscribe);
			return unsubscribe;
		},
		setLivePriority: (priority) => host.liveRate.set(client, priority),
		async publish(name, type) {
			const topic = nt.createTopic<NtValue>(name, typeInfos[type]);
			published.set(name, topic);
			await topic.publish();
		},
		setValue(name, value) {
			published.get(name)?.setValue(value);
		},
		unpublish(name) {
			const topic = published.get(name);
			published.delete(name);
			if (topic?.pubuid !== undefined) {
				topic.unpublish();
			}
		},
		close() {
			if (closed) {
				return;
			}
			closed = true;
			for (const listener of connectionListeners) {
				host.connectionListeners.delete(listener);
			}
			connectionListeners.clear();
			for (const unsubscribe of unsubscribes) {
				unsubscribe();
			}
			for (const name of published.keys()) {
				client.unpublish(name);
			}

			host.clients--;
			if (host.clients === 0) {
				host.removeConnectionListener();
				hosts.delete(key);
				nt.release();
			} else {
				host.liveRate.remove(client);
			}
		},
	};
	return client;
}
