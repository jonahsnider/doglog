/// <reference types="node" />

import { once } from 'node:events';
import { decode, encode } from '@msgpack/msgpack';
import { LoroDoc } from 'loro-crdt';
import { expect, test, vi } from 'vite-plus/test';
import { type WebSocket, WebSocketServer } from 'ws';
import * as z from 'zod';
import { createDashboard, updateDashboard } from '@/dashboards/dashboards';
import { readDashboardDoc } from '@/dashboards/doc';
import { shareDashboards } from '@/dashboards/sharing';
import { openLocalNt } from '@/nt/local';
import { connectSharing } from './nt-sync.ts';

const binaryFrame = z.tuple([z.number(), z.number(), z.number(), z.union([z.number(), z.instanceof(Uint8Array)])]);
const controlFrames = z.array(z.object({ method: z.string(), params: z.record(z.string(), z.unknown()) }));

function serveAfterReconnect(socket: WebSocket, firstPublish: () => void, receive: (name?: string) => void): void {
	let publisher: number | undefined;
	let missedAnnouncement = false;
	socket.binaryType = 'arraybuffer';
	socket.on('message', (data) => {
		if (data instanceof ArrayBuffer) {
			const [id, , , value] = binaryFrame.parse(decode(data));
			if (id === -1) {
				socket.send(encode([-1, Date.now() * 1000, 2, value]));
			} else if (id === publisher && value instanceof Uint8Array) {
				const doc = new LoroDoc();
				doc.import(value);
				receive(readDashboardDoc(doc).name);
			}
			return;
		}
		for (const { method, params } of controlFrames.parse(JSON.parse(data.toString()))) {
			if (method === 'unpublish' && params['pubuid'] === publisher) {
				publisher = undefined;
			}
			// The server only announces a newly registered topic. A retry needs to retire the first registration.
			if (method === 'publish' && publisher === undefined) {
				publisher = z.number().parse(params['pubuid']);
				if (missedAnnouncement) {
					socket.send(JSON.stringify([{ method: 'announce', params: { ...params, id: 1 } }]));
				} else {
					missedAnnouncement = true;
					firstPublish();
				}
			}
		}
	});
}

test('shared edits reach peers after reconnect and a missed publish acknowledgment', async () => {
	const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
	await once(server, 'listening');
	const { port } = z.object({ port: z.number() }).parse(server.address());
	const bootstrap = new Promise<WebSocket>((resolve) => {
		server.once('connection', resolve);
	});
	const peer = new EventTarget();
	const received: (string | undefined)[] = [];
	const signal = AbortSignal.timeout(3500);

	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
	// Shares the connection with the client given to `connectSharing()`
	const watcher = openLocalNt('127.0.0.1', port);
	watcher.onConnectedChange(() => {
		peer.dispatchEvent(new Event('connection-changed'));
	});
	const disconnect = connectSharing(openLocalNt('127.0.0.1', port), () => {});
	try {
		const initialSocket = await bootstrap;
		const { id } = createDashboard();
		shareDashboards([id]);
		updateDashboard(id, (dashboard) => ({ ...dashboard, name: 'Offline edit' }));
		await vi.advanceTimersByTimeAsync(250);
		// Drop the first socket without answering its handshake. The next socket answers RTT but misses the first announce.
		const firstPublish = once(peer, 'first-publish', { signal });
		const socketClosed = once(peer, 'connection-changed', { signal });
		server.once('connection', (socket) => {
			serveAfterReconnect(
				socket,
				() => {
					peer.dispatchEvent(new Event('first-publish'));
				},
				(name) => {
					received.push(name);
					peer.dispatchEvent(new Event('snapshot'));
				},
			);
		});
		initialSocket.terminate();
		await socketClosed;
		await vi.advanceTimersByTimeAsync(1000);
		await firstPublish;

		const snapshot = once(peer, 'snapshot', { signal });
		updateDashboard(id, (dashboard) => ({ ...dashboard, name: 'Latest edit' }));
		await vi.advanceTimersByTimeAsync(4250);
		await snapshot;
		expect(received).toStrictEqual(['Latest edit']);

		const nextSnapshot = once(peer, 'snapshot', { signal });
		updateDashboard(id, (dashboard) => ({ ...dashboard, name: 'Next edit' }));
		await vi.advanceTimersByTimeAsync(250);
		await nextSnapshot;
		expect(received).toStrictEqual(['Latest edit', 'Next edit']);
	} finally {
		watcher.close();
		disconnect();
		vi.useRealTimers();
		for (const socket of server.clients) {
			socket.terminate();
		}
		const closed = once(server, 'close');
		server.close();
		await closed;
	}
});
