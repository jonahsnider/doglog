import type { NetworkTables, SubscribeMessage, UnsubscribeMessage } from '@ntcore-ts/client';
import type { NtClient, NtLivePriority } from '@/nt/client';

type NtInternals = {
	_client: {
		messenger: {
			getNextSubUID(): number;
			socket: {
				websocket: WebSocket;
				getServerTime(): number;
				sendTextFrame(message: SubscribeMessage | UnsubscribeMessage): void;
			};
		};
	};
};

export function messenger(nt: NetworkTables): NtInternals['_client']['messenger'] {
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion
	const internals = nt as unknown as NtInternals;
	// oxlint-disable-next-line no-underscore-dangle
	return internals._client.messenger;
}

/**
 * Send at most two priority subscriptions per connection, a list of exact names and a list of prefixes. NT4 sends
 * one stream per topic at the fastest requested rate, so the existing live listener receives those values too.
 */
export function liveRate(nt: NetworkTables) {
	const transport = messenger(nt);
	const clients = new Map<NtClient, NtLivePriority>();
	const subscriptions = new Map<boolean, { id: number; key: string }>();
	let sentFullRate = false;

	const update = () => {
		if (!nt.isRobotConnected()) {
			return;
		}
		const topics = new Set<string>();
		const prefixes = new Set<string>();
		let full = false;
		for (const priority of clients.values()) {
			if (priority === 'full') {
				full = true;
				break;
			}
			for (const name of priority.topics) {
				topics.add(name);
			}
			for (const name of priority.prefixes) {
				prefixes.add(name);
			}
		}
		if (!full && sentFullRate && clients.size > 0) {
			// Older servers keep sending every change for a topic that ever had `all`, even after unsubscribing.
			// Reconnect once so those servers can coalesce background values too.
			transport.socket.websocket.close();
			return;
		}
		sentFullRate ||= full;
		for (const [prefix, names] of [
			[false, full ? [] : [...topics].toSorted()],
			[true, full ? ['/'] : [...prefixes].toSorted()],
		] as const) {
			const previous = subscriptions.get(prefix);
			if (names.length === 0) {
				if (previous !== undefined) {
					transport.socket.sendTextFrame({ method: 'unsubscribe', params: { subuid: previous.id } });
					subscriptions.delete(prefix);
				}
				continue;
			}
			const key = JSON.stringify([full, names]);
			if (key === previous?.key) {
				continue;
			}
			const id = previous?.id ?? transport.getNextSubUID();
			transport.socket.sendTextFrame({
				method: 'subscribe',
				params: { topics: names, subuid: id, options: { prefix, all: full, periodic: 0.02 } },
			});
			subscriptions.set(prefix, { id, key });
		}
	};

	return {
		set(client: NtClient, priority: NtLivePriority) {
			clients.set(client, priority);
			update();
		},
		remove(client: NtClient) {
			if (clients.delete(client)) {
				update();
			}
		},
		connectedChange(connected: boolean) {
			if (connected) {
				update();
			} else {
				sentFullRate = false;
				subscriptions.clear();
			}
		},
	};
}
