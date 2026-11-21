import { LogLevel, NetworkTables, type NetworkTablesPrefixTopic, type NetworkTablesTopic } from '@ntcore-ts/client';
import type { NtClient, NtListener, NtSubscribeOptions, NtTopic, NtValue } from '@/nt/client';

NetworkTables.setLogLevel(LogLevel.WARN);

/** Hooks called by our @ntcore-ts/client patch */
type PatchedPrefixTopic = NetworkTablesPrefixTopic & {
	onUnannounce?: (params: { name: string }) => void;
	onProperties?: (params: { name: string; update: Record<string, unknown> }) => void;
};

type NtInternals = { _client: { messenger: { socket: { getServerTime(): number } } } };

/** One subscription to the server, shared by every listener with the same prefix and options */
type Subscription = {
	prefix: string;
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
	removeConnectionListener: () => void;
};

const hosts = new Map<string, Host>();
const hookedTopics = new WeakSet<NetworkTablesPrefixTopic>();

function subscriptionsTo(host: Host, prefix: string): Subscription[] {
	return [...host.subscriptions.values()].filter((subscription) => subscription.prefix === prefix);
}

function hookTopic(host: Host, topic: PatchedPrefixTopic): void {
	if (hookedTopics.has(topic)) {
		return;
	}
	hookedTopics.add(topic);

	const announce = topic.announce.bind(topic);
	topic.announce = (params) => {
		announce(params);
		const announced: NtTopic = { name: params.name, type: params.type, properties: { ...params.properties } };
		for (const subscription of subscriptionsTo(host, topic.name)) {
			subscription.topics.set(announced.name, announced);
			for (const listener of subscription.listeners) {
				listener.announce?.(announced);
			}
		}
	};
	topic.onUnannounce = ({ name }) => {
		for (const subscription of subscriptionsTo(host, topic.name)) {
			subscription.topics.delete(name);
			subscription.values.delete(name);
			for (const listener of subscription.listeners) {
				listener.unannounce?.(name);
			}
		}
	};
	topic.onProperties = ({ name, update }) => {
		for (const subscription of subscriptionsTo(host, topic.name)) {
			const announced = subscription.topics.get(name);
			if (announced) {
				const properties = { ...announced.properties, ...update };
				for (const [key, value] of Object.entries(update)) {
					if (value === null) {
						delete properties[key];
					}
				}
				subscription.topics.set(name, { ...announced, properties });
			}
			for (const listener of subscription.listeners) {
				listener.properties?.(name, update);
			}
		}
	};
}

function subscribe(host: Host, prefix: string, options: NtSubscribeOptions): Subscription {
	const topic: PatchedPrefixTopic = host.nt.getPrefixTopic(prefix);
	hookTopic(host, topic);
	const subscription: Subscription = {
		prefix,
		listeners: new Set(),
		topics: new Map(),
		values: new Map(),
		unsubscribe: () => {},
	};

	// The server sends each topic to a client once, so topics other subscriptions received aren't sent for this one
	for (const other of host.subscriptions.values()) {
		for (const [name, announced] of other.topics) {
			if (name.startsWith(prefix)) {
				subscription.topics.set(name, announced);
			}
		}
		for (const [name, value] of other.values) {
			if (name.startsWith(prefix)) {
				subscription.values.set(name, value);
			}
		}
	}

	const subuid = topic.subscribe(
		(value, params) => {
			if (value === null) {
				subscription.values.delete(params.name);
				return;
			}
			// Set right before subscribers are called
			const serverTime = topic.lastChangedTime ?? 0;
			subscription.values.set(params.name, { type: params.type, value, serverTime });
			for (const listener of subscription.listeners) {
				listener.value?.(params.name, params.type, value, serverTime);
			}
		},
		{
			...options,
			// The NT4 client subscribes to some prefixes itself, ex. struct schemas, so use what it received
			immediateNotify: topic.subscribers.size > 0,
		},
	);
	subscription.unsubscribe = () => topic.unsubscribe(subuid);
	return subscription;
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
			removeConnectionListener: () => {},
		};
		created.removeConnectionListener = nt.addRobotConnectionListener((connected) => {
			created.connected = connected;
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
	const published = new Map<
		string,
		{ kind: 'raw'; topic: NetworkTablesTopic<Uint8Array> } | { kind: 'string'; topic: NetworkTablesTopic<string> }
	>();

	const client: NtClient = {
		isConnected: () => host.connected,
		// Connection listeners are only called once the client synced its clock with the server's
		serverTime: () => {
			if (!host.connected) {
				return undefined;
			}
			// oxlint-disable-next-line typescript/no-unsafe-type-assertion
			const internals = nt as unknown as NtInternals;
			// oxlint-disable-next-line no-underscore-dangle
			return internals._client.messenger.socket.getServerTime();
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
					listener.announce?.(announced);
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
		async publish(name, kind) {
			const publisher =
				kind === 'raw'
					? ({ kind, topic: nt.getRawTopic(name) } as const)
					: ({ kind, topic: nt.getStringTopic(name) } as const);
			published.set(name, publisher);
			await publisher.topic.publish();
		},
		setValue(name, value) {
			const publisher = published.get(name);
			if (publisher?.kind === 'raw' && value instanceof Uint8Array) {
				publisher.topic.setValue(value);
			} else if (publisher?.kind === 'string' && typeof value === 'string') {
				publisher.topic.setValue(value);
			}
		},
		unpublish(name) {
			const publisher = published.get(name);
			published.delete(name);
			if (publisher?.topic.pubuid !== undefined) {
				publisher.topic.unpublish();
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
			}
		},
	};
	return client;
}
