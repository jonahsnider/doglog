import { hasWpilogMagic } from '@/data/log-source';
import {
	authErrorMessage,
	corsErrorMessage,
	describeHttpError,
	guessLogFileName,
	htmlResponseMessage,
	initialLogLabel,
	isHtmlContentType,
	isMixedContentUrl,
	mixedContentMessage,
	normalizeLogUrl,
} from '@/data/log-url';
import { openLogUrlDesktop, showUrlErrorToast } from '@/data/open-log-url-desktop';
import { openLogStream } from '@/data/source';

export type OpenLogUrlErrorKind =
	| 'invalid'
	| 'mixed-content'
	| 'cors'
	| 'auth'
	| 'html'
	| 'http'
	| 'invalid-log'
	| 'network'
	| 'aborted';

export type OpenLogUrlError = {
	kind: OpenLogUrlErrorKind;
	message: string;
	/** Normalized URL, when valid */
	url?: string;
};

export type OpenLogUrlResult =
	/** `id` is the log's in the window's sources */
	{ ok: true; fileName: string; id: string } | { ok: false; error: OpenLogUrlError };

/** Read chunks sequentially from `reader` until at least 6 bytes are buffered or the stream ends */
async function readInitialMagic(
	reader: ReadableStreamDefaultReader<Uint8Array>,
	chunks: Uint8Array[] = [],
	length = 0,
): Promise<{ initial: Uint8Array; done: boolean }> {
	if (length >= 6) {
		const initial = new Uint8Array(length);
		let offset = 0;
		for (const chunk of chunks) {
			initial.set(chunk, offset);
			offset += chunk.byteLength;
		}
		return { initial, done: false };
	}
	const step = await reader.read();
	if (step.done) {
		const initial = new Uint8Array(length);
		let offset = 0;
		for (const chunk of chunks) {
			initial.set(chunk, offset);
			offset += chunk.byteLength;
		}
		return { initial, done: true };
	}
	if (step.value.byteLength > 0) {
		chunks.push(step.value);
	}
	return readInitialMagic(reader, chunks, length + step.value.byteLength);
}

function parseContentLength(header: string | null): number | undefined {
	if (header === null || !/^\d+$/u.test(header.trim())) {
		return undefined;
	}
	const value = Math.trunc(Number(header.trim()));
	return Number.isSafeInteger(value) ? value : undefined;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	if (bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength && bytes.buffer instanceof ArrayBuffer) {
		return bytes.buffer;
	}
	return bytes.slice().buffer;
}

async function pumpReader(
	reader: ReadableStreamDefaultReader<Uint8Array>,
	stream: ReturnType<typeof openLogStream>,
	controller: AbortController,
	totalBytes: number | undefined,
	downloaded: number,
): Promise<void> {
	try {
		const step = await reader.read();
		if (step.done) {
			if (totalBytes !== undefined && downloaded < totalBytes) {
				stream.fail('Download ended early (connection interrupted).');
				return;
			}
			stream.finish();
			return;
		}
		if (!stream.isActive()) {
			void reader.cancel().catch(() => {});
			return;
		}
		let nextDownloaded = downloaded;
		if (step.value.byteLength > 0) {
			nextDownloaded += step.value.byteLength;
			stream.push(toArrayBuffer(step.value), nextDownloaded);
		}
		await pumpReader(reader, stream, controller, totalBytes, nextDownloaded);
	} catch (caught) {
		if (!stream.isActive() || controller.signal.aborted) {
			return;
		}
		stream.fail(`Download failed: ${caught instanceof Error ? caught.message : String(caught)}`);
	}
}

async function openLogUrlWeb(
	normalized: URL,
	options: { signal?: AbortSignal; showToast: boolean; onError?: (message: string) => void },
): Promise<OpenLogUrlResult> {
	const label = initialLogLabel(normalized.href);
	const failBeforeStream = (error: OpenLogUrlError): OpenLogUrlResult => {
		if (options.showToast) {
			showUrlErrorToast(`Couldn't open ${label}`, error);
		}
		if (error.kind !== 'aborted') {
			options.onError?.(error.message);
		}
		return { ok: false, error };
	};

	if (isMixedContentUrl(normalized)) {
		return failBeforeStream({ kind: 'mixed-content', message: mixedContentMessage, url: normalized.href });
	}

	const controller = new AbortController();
	const abortFromCaller = () => controller.abort();
	if (options.signal !== undefined) {
		if (options.signal.aborted) {
			return { ok: false, error: { kind: 'aborted', message: 'Canceled.', url: normalized.href } };
		}
		options.signal.addEventListener('abort', abortFromCaller, { once: true });
	}

	let response: Response;
	try {
		response = await fetch(normalized.href, { signal: controller.signal });
	} catch (caught) {
		options.signal?.removeEventListener('abort', abortFromCaller);
		if (controller.signal.aborted) {
			return { ok: false, error: { kind: 'aborted', message: 'Canceled.', url: normalized.href } };
		}
		// Browsers throw TypeError for both CORS blocks and unreachable hosts
		const error: OpenLogUrlError =
			caught instanceof TypeError
				? { kind: 'cors', message: corsErrorMessage, url: normalized.href }
				: {
						kind: 'network',
						message: caught instanceof Error ? caught.message : String(caught),
						url: normalized.href,
					};
		return failBeforeStream(error);
	}

	if (response.status === 401 || response.status === 403) {
		void response.body?.cancel();
		options.signal?.removeEventListener('abort', abortFromCaller);
		return failBeforeStream({ kind: 'auth', message: authErrorMessage, url: normalized.href });
	}
	if (!response.ok) {
		void response.body?.cancel();
		options.signal?.removeEventListener('abort', abortFromCaller);
		return failBeforeStream({
			kind: 'http',
			message: describeHttpError(response.status, response.statusText),
			url: normalized.href,
		});
	}
	if (isHtmlContentType(response.headers.get('Content-Type'))) {
		void response.body?.cancel();
		options.signal?.removeEventListener('abort', abortFromCaller);
		return failBeforeStream({ kind: 'html', message: htmlResponseMessage, url: normalized.href });
	}

	// Reject non-HTTP(S) redirects if the browser exposed a different final URL
	if (response.url !== '' && !/^https?:/iu.test(response.url)) {
		void response.body?.cancel();
		options.signal?.removeEventListener('abort', abortFromCaller);
		return failBeforeStream({
			kind: 'invalid',
			message: 'Redirected to an unsupported URL scheme.',
			url: normalized.href,
		});
	}

	const { body } = response;
	if (body === null) {
		options.signal?.removeEventListener('abort', abortFromCaller);
		return failBeforeStream({ kind: 'invalid-log', message: "It's empty.", url: normalized.href });
	}

	const reader = body.getReader();
	let initial: Uint8Array;
	let reachedEof: boolean;
	try {
		({ initial, done: reachedEof } = await readInitialMagic(reader));
	} catch (caught) {
		options.signal?.removeEventListener('abort', abortFromCaller);
		if (controller.signal.aborted) {
			return { ok: false, error: { kind: 'aborted', message: 'Canceled.', url: normalized.href } };
		}
		return failBeforeStream({
			kind: 'network',
			message: `Download failed: ${caught instanceof Error ? caught.message : String(caught)}`,
			url: normalized.href,
		});
	}

	if (initial.byteLength === 0) {
		void reader.cancel();
		options.signal?.removeEventListener('abort', abortFromCaller);
		return failBeforeStream({ kind: 'invalid-log', message: "It's empty.", url: normalized.href });
	}
	if (!hasWpilogMagic(initial)) {
		void reader.cancel();
		options.signal?.removeEventListener('abort', abortFromCaller);
		return failBeforeStream({ kind: 'invalid-log', message: "It isn't a WPILOG file.", url: normalized.href });
	}

	// Headers and magic bytes validated; hand ownership of cancellation to the active log stream
	options.signal?.removeEventListener('abort', abortFromCaller);
	const fileName = guessLogFileName(response.url || normalized.href, response.headers.get('Content-Disposition'));
	// When the server compressed the HTTP response with gzip/br, Content-Length is compressed bytes while `body` yields
	// decoded bytes, so omit Content-Length unless no Content-Encoding is set
	const encoding = response.headers.get('Content-Encoding');
	const totalBytes =
		encoding !== null && encoding !== '' ? undefined : parseContentLength(response.headers.get('Content-Length'));

	const stream = openLogStream({
		name: fileName,
		totalBytes,
		onCancel: () => {
			controller.abort();
			void reader.cancel().catch(() => {});
		},
		onError: options.onError,
	});

	const downloaded = initial.byteLength;
	stream.push(toArrayBuffer(initial), downloaded);
	if (reachedEof) {
		if (totalBytes !== undefined && downloaded < totalBytes) {
			stream.fail('Download ended early (connection interrupted).');
		} else {
			stream.finish();
		}
	} else {
		void pumpReader(reader, stream, controller, totalBytes, downloaded);
	}

	return { ok: true, fileName, id: stream.id };
}

/**
 * Validate and stream a WPILOG or `.wpilogxz` file from an HTTP(S) URL.
 * Validates headers and the first 6 magic bytes before adding it to the window's sources.
 */
export function openLogUrl(
	rawUrl: string,
	options?: { signal?: AbortSignal; showToast?: boolean; onError?: (message: string) => void },
): Promise<OpenLogUrlResult> {
	const showToast = options?.showToast ?? true;
	const normalized = normalizeLogUrl(rawUrl);
	if (normalized === undefined) {
		const error: OpenLogUrlError = {
			kind: 'invalid',
			message: 'Enter a valid http:// or https:// URL.',
		};
		if (showToast) {
			showUrlErrorToast("Couldn't open log URL", error);
		}
		options?.onError?.(error.message);
		return Promise.resolve({ ok: false, error });
	}
	return STUDIO_DESKTOP
		? openLogUrlDesktop(normalized, { signal: options?.signal, showToast, onError: options?.onError })
		: openLogUrlWeb(normalized, { signal: options?.signal, showToast, onError: options?.onError });
}
