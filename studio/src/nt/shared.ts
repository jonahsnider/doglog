import type { NtClient, NtListener } from '@/nt/client';
import type { NtWorkerEvent, NtWorkerRequest } from '@/nt/nt-worker';

type Client = {
	connected: boolean;
	/** This tab's clock (µs) minus the server's, while connected */
	clockOffset: number | undefined;
	connectionListeners: Set<(connected: boolean) => void>;
};

const clients = new Map<number, Client>();
const listeners = new Map<number, NtListener>();
const publishes = new Map<number, { resolve: () => void; reject: (error: Error) => void }>();
let nextId = 0;
let port: MessagePort | undefined;

function handle(event: NtWorkerEvent): void {
	switch (event.type) {
		case 'connected': {
			const client = clients.get(event.client);
			if (client) {
				client.connected = event.connected;
				// The worker has its own clock, so only the server's time is sent
				client.clockOffset = event.serverTime === undefined ? undefined : performance.now() * 1000 - event.serverTime;
				for (const listener of client.connectionListeners) {
					listener(event.connected);
				}
			}
			break;
		}
		case 'announce':
			listeners.get(event.subscription)?.announce?.(event.topic);
			break;
		case 'unannounce':
			listeners.get(event.subscription)?.unannounce?.(event.name);
			break;
		case 'properties':
			listeners.get(event.subscription)?.properties?.(event.name, event.update);
			break;
		case 'value':
			listeners.get(event.subscription)?.value?.(event.name, event.topicType, event.value, event.serverTime);
			break;
		case 'published': {
			const publish = publishes.get(event.request);
			publishes.delete(event.request);
			if (event.error === undefined) {
				publish?.resolve();
			} else {
				publish?.reject(new Error(event.error));
			}
			break;
		}
	}
}

function send(request: NtWorkerRequest): void {
	if (!port) {
		const worker = new SharedWorker(new URL('./nt-worker.ts', import.meta.url), { type: 'module', name: 'nt' });
		port = worker.port;
		port.addEventListener('message', ({ data }: MessageEvent<NtWorkerEvent[]>) => {
			for (const event of data) {
				handle(event);
			}
		});
		port.start();
		// Held until this tab or window closes, which tells the worker to close its clients
		const lock = `doglog-studio:nt-${crypto.randomUUID()}`;
		void navigator.locks.request(lock, () => {
			send({ type: 'hello', lock });
			return new Promise(() => {});
		});
	}
	port.postMessage(request);
}

/** A client of the NT4 server at `host` through a shared worker, which shares one connection with other tabs and windows */
export function openSharedNt(host: string): NtClient {
	const id = nextId++;
	const client: Client = { connected: false, clockOffset: undefined, connectionListeners: new Set() };
	clients.set(id, client);
	const subscriptions = new Set<number>();
	send({ type: 'open', client: id, host });

	return {
		isConnected: () => client.connected,
		serverTime: () => (client.clockOffset === undefined ? undefined : performance.now() * 1000 - client.clockOffset),
		onConnectedChange(listener) {
			client.connectionListeners.add(listener);
			queueMicrotask(() => {
				if (client.connectionListeners.has(listener)) {
					listener(client.connected);
				}
			});
			return () => {
				client.connectionListeners.delete(listener);
			};
		},
		subscribe(prefix, options, listener) {
			const subscription = nextId++;
			listeners.set(subscription, listener);
			subscriptions.add(subscription);
			send({ type: 'subscribe', client: id, subscription, prefix, options });
			return () => {
				if (subscriptions.delete(subscription)) {
					listeners.delete(subscription);
					send({ type: 'unsubscribe', client: id, subscription });
				}
			};
		},
		publish(name, kind) {
			const request = nextId++;
			send({ type: 'publish', client: id, request, name, kind });
			return new Promise((resolve, reject) => {
				publishes.set(request, { resolve, reject });
			});
		},
		setValue: (name, value) => send({ type: 'set', client: id, name, value }),
		unpublish: (name) => send({ type: 'unpublish', client: id, name }),
		close() {
			if (!clients.delete(id)) {
				return;
			}
			for (const subscription of subscriptions) {
				listeners.delete(subscription);
			}
			subscriptions.clear();
			send({ type: 'close', client: id });
		},
	};
}
