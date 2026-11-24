import { Channel, invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { toastManager } from '@/components/toast';
import { guessLogFileName, initialLogLabel } from '@/data/log-url';
import type { OpenLogUrlError, OpenLogUrlErrorKind, OpenLogUrlResult } from '@/data/open-log-url';
import { openLogStream } from '@/data/source';

type StartedLogUrl = {
	id: number;
	finalUrl: string;
	contentDisposition: string | null;
	contentLength: number | null;
};

type RustStartError = {
	kind?: string;
	message?: string;
};

const frameChunk = 0;
const frameEnd = 1;
const frameError = 2;
const textDecoder = new TextDecoder();

function isErrorKind(value: string | undefined): value is OpenLogUrlErrorKind {
	return (
		value === 'invalid' ||
		value === 'mixed-content' ||
		value === 'cors' ||
		value === 'auth' ||
		value === 'html' ||
		value === 'http' ||
		value === 'invalid-log' ||
		value === 'network' ||
		value === 'aborted'
	);
}

function parseDesktopStartError(error: unknown, url: string): OpenLogUrlError {
	if (typeof error === 'object' && error !== null) {
		const { kind, message } = error as RustStartError;
		if (isErrorKind(kind) && typeof message === 'string') {
			return { kind, message, url };
		}
	}
	return { kind: 'network', message: error instanceof Error ? error.message : String(error), url };
}

export function showUrlErrorToast(title: string, error: OpenLogUrlError): void {
	if (error.kind === 'aborted') {
		return;
	}
	const offerBrowser = STUDIO_DESKTOP && (error.kind === 'html' || error.kind === 'auth') && error.url !== undefined;
	toastManager.add({
		type: 'error',
		title,
		description: error.message,
		actionProps: offerBrowser ? { children: 'Open in browser', onClick: () => void openUrl(error.url!) } : undefined,
	});
}

/** Stream a remote log URL natively through Rust (no browser CORS limits) */
export async function openLogUrlDesktop(
	normalized: URL,
	options: { signal?: AbortSignal; showToast: boolean; onError?: (message: string) => void },
): Promise<OpenLogUrlResult> {
	const label = initialLogLabel(normalized.href);
	const bufferedFrames: ArrayBuffer[] = [];
	const streamRef: { current: ReturnType<typeof openLogStream> | undefined } = { current: undefined };

	const deliverFrame = (frame: ArrayBuffer) => {
		const stream = streamRef.current;
		if (stream === undefined || frame.byteLength < 9) {
			return;
		}
		const view = new DataView(frame);
		const tag = view.getUint8(0);
		// Safe up to 2^53 - 1 bytes
		const downloaded = view.getUint32(1, true) + view.getUint32(5, true) * 2 ** 32;
		switch (tag) {
			case frameChunk:
				stream.push(frame.slice(9), downloaded);
				break;
			case frameEnd:
				stream.finish();
				break;
			case frameError: {
				const message = textDecoder.decode(new Uint8Array(frame, 9));
				stream.fail(message);
				break;
			}
		}
	};

	const channel = new Channel<ArrayBuffer>((frame) => {
		if (streamRef.current === undefined) {
			bufferedFrames.push(frame);
		} else {
			deliverFrame(frame);
		}
	});

	let started: StartedLogUrl;
	try {
		started = await invoke<StartedLogUrl>('start_log_url', {
			url: normalized.href,
			onEvent: channel,
		});
	} catch (caught) {
		if (options.signal?.aborted === true) {
			return { ok: false, error: { kind: 'aborted', message: 'Canceled.', url: normalized.href } };
		}
		const error = parseDesktopStartError(caught, normalized.href);
		if (options.showToast) {
			showUrlErrorToast(`Couldn't open ${label}`, error);
		}
		options.onError?.(error.message);
		return { ok: false, error };
	}

	if (options.signal?.aborted === true) {
		void invoke('cancel_log_url', { id: started.id });
		return { ok: false, error: { kind: 'aborted', message: 'Canceled.', url: normalized.href } };
	}

	const fileName = guessLogFileName(started.finalUrl, started.contentDisposition);
	streamRef.current = openLogStream({
		name: fileName,
		totalBytes: started.contentLength ?? undefined,
		onCancel: () => void invoke('cancel_log_url', { id: started.id }),
		onError: options.onError,
	});
	for (const frame of bufferedFrames) {
		deliverFrame(frame);
	}
	bufferedFrames.length = 0;

	return { ok: true, fileName };
}
