import { invoke } from '@tauri-apps/api/core';
import { MjpegParser } from '@/widgets/camera/mjpeg';

type AddressSpace = 'local' | 'loopback';
type FrameConsumer = (jpeg: Blob) => void;
const textDecoder = new TextDecoder();

function cameraUrl(raw: string): URL | undefined {
	if (!/^https?:\/\/[^/\\?#@]+(?:[/\\?#]|$)/iu.test(raw.trim())) {
		return undefined;
	}
	const url = URL.parse(raw);
	return url !== null && !url.username && !url.password ? url : undefined;
}

function addressSpace(hostname: string): AddressSpace | undefined {
	const host = hostname.replace(/\.$/u, '');
	if (host === 'localhost' || host.endsWith('.localhost') || host === '[::1]') {
		return 'loopback';
	}
	if (host.endsWith('.local') || /^\[(?:f[cd][\da-f]{2}|fe[89ab][\da-f]):/u.test(host)) {
		return 'local';
	}
	const mapped = /^\[::ffff:([\da-f]+):[\da-f]+\]$/u.exec(host)?.[1];
	const upper = mapped === undefined ? undefined : Number.parseInt(mapped, 16);
	const ipv4 = /^([\d]+)\.([\d]+)\.[\d]+\.[\d]+$/u.exec(host);
	const a = upper === undefined ? Number(ipv4?.[1]) : upper >>> 8;
	const b = upper === undefined ? Number(ipv4?.[2]) : upper & 0xff;
	if (a === 127) {
		return 'loopback';
	}
	if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)) {
		return 'local';
	}
	return undefined;
}

/** Query Local Network Access without opening a connection or prompting. Unknown hostnames are not resolved here. */
export async function cameraPermission(url: string): Promise<PermissionState | undefined> {
	if (STUDIO_DESKTOP || !globalThis.isSecureContext) {
		return undefined;
	}
	const parsed = cameraUrl(url);
	const target = parsed === undefined ? undefined : addressSpace(parsed.hostname);
	const origin = addressSpace(location.hostname);
	if (target === undefined || target === origin || origin === 'loopback') {
		return undefined;
	}
	const name = target === 'local' ? 'local-network' : 'loopback-network';
	try {
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- TypeScript doesn't know the Local Network Access permissions yet
		return (await navigator.permissions.query({ name: name as PermissionName })).state;
	} catch {
		return undefined;
	}
}

async function consumeFrames(
	contentType: string | null,
	read: () => Promise<Uint8Array | undefined>,
	signal: AbortSignal,
	onFrame: FrameConsumer,
): Promise<never> {
	signal.throwIfAborted();
	const parser = new MjpegParser(contentType);
	while (!parser.ended) {
		// oxlint-disable-next-line no-await-in-loop -- Read only after all frames from the previous chunk were consumed.
		const chunk = await read();
		signal.throwIfAborted();
		if (chunk === undefined) {
			break;
		}
		for (const frame of parser.push(chunk)) {
			onFrame(frame);
			signal.throwIfAborted();
		}
	}
	throw new Error('Camera stream ended.');
}

async function streamBrowser(url: URL, signal: AbortSignal, onFrame: FrameConsumer): Promise<void> {
	const options: RequestInit & { targetAddressSpace?: AddressSpace } = {
		signal,
		credentials: 'omit',
		referrerPolicy: 'no-referrer',
		redirect: 'error',
		cache: 'no-store',
	};
	const space = addressSpace(url.hostname);
	if (space !== undefined) {
		options.targetAddressSpace = space;
	}
	const response = await fetch(url, options);
	const reader = response.body?.getReader();
	try {
		if (!response.ok) {
			throw new Error(`Camera responded with HTTP ${response.status}.`);
		}
		if (reader === undefined) {
			throw new Error('Camera response has no stream body.');
		}
		await consumeFrames(response.headers.get('Content-Type'), async () => (await reader.read()).value, signal, onFrame);
	} finally {
		if (reader !== undefined) {
			void reader.cancel().catch(() => {});
			reader.releaseLock();
		}
	}
}

async function streamDesktop(url: URL, signal: AbortSignal, onFrame: FrameConsumer): Promise<void> {
	const start = invoke<number>('start_camera_stream', { url: url.href });
	let rejectAbort!: (error: Error) => void;
	const aborted = new Promise<never>((_resolve, reject) => {
		rejectAbort = reject;
	});
	const abort = () => rejectAbort(new DOMException('Camera stream aborted.', 'AbortError'));
	signal.addEventListener('abort', abort, { once: true });
	try {
		const consume = async () => {
			const id = await start;
			signal.throwIfAborted();
			const read = async () => {
				// The custom protocol delivers an ArrayBuffer; Tauri's postMessage fallback can deliver a byte array.
				const bytes = await invoke<ArrayBuffer | number[]>('read_camera_stream', { id });
				return new Uint8Array(bytes);
			};
			const contentType = textDecoder.decode(await read());
			await consumeFrames(
				contentType,
				async () => {
					const chunk = await read();
					return chunk.byteLength === 0 ? undefined : chunk;
				},
				signal,
				onFrame,
			);
		};
		await Promise.race([aborted, consume()]);
	} finally {
		signal.removeEventListener('abort', abort);
		// Registration itself cannot be interrupted, but it has not started an HTTP request yet.
		void start.then((id) => invoke('close_camera_stream', { id })).catch(() => {});
	}
}

/** Stream one HTTP(S) MJPEG address. Rejects on end, failure, or abort; does not retry or impose a frame timeout. */
export async function streamCamera(url: string, signal: AbortSignal, onFrame: FrameConsumer): Promise<void> {
	signal.throwIfAborted();
	const parsed = cameraUrl(url);
	if (parsed === undefined) {
		throw new Error('Camera URLs must use HTTP or HTTPS without credentials.');
	}
	try {
		await (STUDIO_DESKTOP ? streamDesktop(parsed, signal, onFrame) : streamBrowser(parsed, signal, onFrame));
	} catch (error) {
		signal.throwIfAborted();
		throw typeof error === 'string' ? new Error(error) : error;
	}
}
