import { once } from 'node:events';
import { createServer, type RequestListener } from 'node:http';
import { expect, test } from 'vite-plus/test';
import { streamCamera } from '@/widgets/camera/stream';

const mime = 'multipart/x-mixed-replace;boundary=camera';
const jpeg = Uint8Array.of(0xff, 0xd8, 0x41, 0xff, 0xd9);
const headers = '\r\n--camera\r\nContent-Type: image/jpeg\r\nContent-Length: 5\r\n\r\n';

async function withServer(handle: RequestListener, run: (url: string) => Promise<void>): Promise<void> {
	const server = createServer(handle);
	server.listen(0, '127.0.0.1');
	await once(server, 'listening');
	try {
		const address = server.address();
		if (address === null || typeof address === 'string') {
			throw new Error('Expected TCP test server.');
		}
		await run(`http://127.0.0.1:${address.port}/stream`);
	} finally {
		const closed = once(server, 'close');
		server.close();
		server.closeAllConnections();
		await closed;
	}
}

test.skipIf(STUDIO_DESKTOP)('surfaces EOF without emitting an incomplete trailing frame', async () => {
	await withServer(
		(_request, response) => {
			response.setHeader('Content-Type', mime);
			response.write(headers);
			response.write(jpeg);
			response.write(headers);
			response.end(jpeg.subarray(0, -1));
		},
		async (url) => {
			const frames: Blob[] = [];
			await expect(streamCamera(url, new AbortController().signal, (frame) => void frames.push(frame))).rejects.toThrow(
				'Camera stream ended.',
			);
			expect(await Promise.all(frames.map((frame) => frame.bytes()))).toEqual([jpeg]);
		},
	);
});

test.skipIf(STUDIO_DESKTOP)('aborting after a frame closes the live response and emits no more frames', async () => {
	const reason = new Error('Camera hidden');
	const controller = new AbortController();
	let disconnected!: Promise<unknown>;
	await withServer(
		(_request, response) => {
			disconnected = once(response, 'close');
			response.setHeader('Content-Type', mime);
			response.write(headers);
			response.write(jpeg);
			response.write(headers);
			response.write(jpeg);
		},
		async (url) => {
			const frames: Blob[] = [];
			await expect(
				streamCamera(url, controller.signal, (frame) => {
					frames.push(frame);
					controller.abort(reason);
				}),
			).rejects.toBe(reason);
			await disconnected;
			expect(await Promise.all(frames.map((frame) => frame.bytes()))).toEqual([jpeg]);
		},
	);
});

test.skipIf(STUDIO_DESKTOP)('rejects a wrong response type', async () => {
	await withServer(
		(_request, response) => {
			response.writeHead(200, { 'Content-Type': 'text/html' }).end('<h1>Not a camera</h1>');
		},
		async (url) => {
			const frames: Blob[] = [];
			const stream = streamCamera(url, new AbortController().signal, (frame) => void frames.push(frame));
			await expect(stream).rejects.toThrow('not a multipart MJPEG stream');
			expect(frames).toEqual([]);
		},
	);
});

test.skipIf(STUDIO_DESKTOP)('does not follow redirects', async () => {
	const requests: (string | undefined)[] = [];
	await withServer(
		(request, response) => {
			requests.push(request.url);
			response.writeHead(302, { Location: '/must-not-fetch' }).end();
		},
		async (url) => {
			const frames: Blob[] = [];
			const stream = streamCamera(url, new AbortController().signal, (frame) => void frames.push(frame));
			await expect(stream).rejects.toThrow(TypeError);
			expect(frames).toEqual([]);
			expect(requests).toEqual(['/stream']);
		},
	);
});
