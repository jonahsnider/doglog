// Shares NT4 connections between tabs and windows, see `openNt()`
import type { NtClient, NtLivePriority, NtPublishType, NtSubscribeOptions, NtTopic, NtValue } from '@/nt/client';
import { openLocalNt } from '@/nt/local';

/** Sent by `shared.ts`. IDs are chosen by the tab or window, and only unique within it. */
export type NtWorkerRequest =
	/** The Web Lock the tab or window holds until it closes */
	| { type: 'hello'; lock: string }
	| { type: 'open'; client: number; host: string }
	| { type: 'subscribe'; client: number; subscription: number; prefix: string; options: NtSubscribeOptions }
	| { type: 'unsubscribe'; client: number; subscription: number }
	| { type: 'live-priority'; client: number; priority: NtLivePriority }
	| { type: 'publish'; client: number; request: number; name: string; topicType: NtPublishType }
	| { type: 'set'; client: number; name: string; value: NtValue }
	| { type: 'unpublish'; client: number; name: string }
	| { type: 'close'; client: number };

/** Sent to `shared.ts` in batches */
export type NtWorkerEvent =
	/** `serverTime` is the server's clock when this was sent */
	| { type: 'connected'; client: number; connected: boolean; serverTime: number | undefined }
	| { type: 'announce'; subscription: number; topic: NtTopic }
	| { type: 'unannounce'; subscription: number; name: string }
	| { type: 'properties'; subscription: number; name: string; update: Record<string, unknown> }
	| { type: 'value'; subscription: number; name: string; topicType: string; value: NtValue; serverTime: number }
	| { type: 'published'; request: number; error?: string };

addEventListener('connect', (event) => {
	if (!(event instanceof MessageEvent)) {
		return;
	}
	const port = event.ports[0]!;
	const clients = new Map<number, { nt: NtClient; subscriptions: Map<number, () => void> }>();

	// Values arrive many at a time, one message for each would flood the tab
	let batch: NtWorkerEvent[] = [];
	const send = (workerEvent: NtWorkerEvent) => {
		if (batch.length === 0) {
			queueMicrotask(() => {
				port.postMessage(batch);
				batch = [];
			});
		}
		batch.push(workerEvent);
	};

	const closeClient = (id: number) => {
		clients.get(id)?.nt.close();
		clients.delete(id);
	};

	port.addEventListener('message', ({ data: request }: MessageEvent<NtWorkerRequest>) => {
		if (request.type === 'hello') {
			// Granted once the tab or window closes, since ports don't say when they're gone
			void navigator.locks.request(request.lock, () => {
				for (const id of clients.keys()) {
					closeClient(id);
				}
				port.close();
			});
			return;
		}
		if (request.type === 'open') {
			const nt = openLocalNt(request.host);
			clients.set(request.client, { nt, subscriptions: new Map() });
			nt.onConnectedChange((connected) =>
				send({ type: 'connected', client: request.client, connected, serverTime: nt.serverTime() }),
			);
			return;
		}

		const client = clients.get(request.client);
		if (!client) {
			return;
		}
		const { nt, subscriptions } = client;
		switch (request.type) {
			case 'subscribe': {
				const { subscription } = request;
				const unsubscribe = nt.subscribe(request.prefix, request.options, {
					announce: (topic) => send({ type: 'announce', subscription, topic }),
					unannounce: (name) => send({ type: 'unannounce', subscription, name }),
					properties: (name, update) => send({ type: 'properties', subscription, name, update }),
					value: (name, topicType, value, serverTime) =>
						send({ type: 'value', subscription, name, topicType, value, serverTime }),
				});
				subscriptions.set(subscription, unsubscribe);
				break;
			}
			case 'unsubscribe':
				subscriptions.get(request.subscription)?.();
				subscriptions.delete(request.subscription);
				break;
			case 'live-priority':
				nt.setLivePriority(request.priority);
				break;
			case 'publish':
				nt.publish(request.name, request.topicType).then(
					() => send({ type: 'published', request: request.request }),
					(error: unknown) => send({ type: 'published', request: request.request, error: String(error) }),
				);
				break;
			case 'set':
				nt.setValue(request.name, request.value);
				break;
			case 'unpublish':
				nt.unpublish(request.name);
				break;
			case 'close':
				closeClient(request.client);
				break;
		}
	});
	port.start();
});
