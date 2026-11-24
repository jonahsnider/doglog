import { useEffect, useEffectEvent, useState } from 'react';
import { cameraPermission, streamCamera } from '@/widgets/camera/stream';

const frameTimeout = 4000;
const retryDelay = 1500;

type FeedStatus = 'loading' | 'live' | 'unavailable' | 'permission' | 'denied';

async function playCamera(
	surface: HTMLCanvasElement,
	lifetime: AbortSignal,
	allowPrompt: boolean,
	advertised: () => readonly string[],
	canPlay: (url: string, received: boolean) => boolean,
	getRotation: () => number,
	setStatus: (status: FeedStatus) => void,
	onFrame: (surface: HTMLCanvasElement | undefined) => void,
) {
	const context = surface.getContext('2d')!;
	const clear = () => {
		context.clearRect(0, 0, surface.width, surface.height);
		onFrame(undefined);
	};
	lifetime.addEventListener('abort', clear, { once: true });
	while (!lifetime.aborted) {
		let failure: FeedStatus = 'unavailable';
		for (const url of advertised()) {
			// oxlint-disable-next-line no-await-in-loop -- Try one address at a time, without opening extra streams.
			const permission = await cameraPermission(url);
			if (lifetime.aborted || !advertised().includes(url)) {
				break;
			}
			if (permission === 'denied') {
				if (failure !== 'permission') {
					failure = 'denied';
				}
				continue;
			}
			if (permission === 'prompt' && !allowPrompt) {
				failure = 'permission';
				continue;
			}
			const attempt = new AbortController();
			const signal = AbortSignal.any([lifetime, attempt.signal]);
			let timeout = setTimeout(() => attempt.abort(), permission === 'prompt' ? 60_000 : frameTimeout);
			let drawing = false;
			let received = false;
			const draw = async (jpeg: Blob) => {
				if (drawing || signal.aborted) {
					return;
				}
				drawing = true;
				try {
					const bitmap = await createImageBitmap(jpeg);
					try {
						if (signal.aborted || !canPlay(url, received)) {
							attempt.abort();
							return;
						}
						const rotation = getRotation();
						const sideways = rotation % 180 !== 0;
						const width = sideways ? bitmap.height : bitmap.width;
						const height = sideways ? bitmap.width : bitmap.height;
						if (surface.width !== width || surface.height !== height) {
							surface.width = width;
							surface.height = height;
						}
						context.translate(width / 2, height / 2);
						context.rotate((rotation * Math.PI) / 180);
						context.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
						onFrame(surface);
						clearTimeout(timeout);
						timeout = setTimeout(() => attempt.abort(), frameTimeout);
						if (!received) {
							received = true;
							setStatus('live');
						}
					} finally {
						context.resetTransform();
						bitmap.close();
					}
				} catch {
					// Ignore an undecodable frame. A stream with no good frames times out.
				} finally {
					drawing = false;
				}
			};
			try {
				// oxlint-disable-next-line no-await-in-loop -- Only one stream should use the canvas at a time.
				await streamCamera(url, signal, (jpeg) => void draw(jpeg));
			} catch {
				// Advance to the next advertised address on any stream failure.
			} finally {
				attempt.abort();
				clearTimeout(timeout);
			}
			if (received && !lifetime.aborted) {
				clear();
				setStatus('unavailable');
			}
		}
		if (!lifetime.aborted) {
			setStatus(failure);
			const backoff = AbortSignal.any([lifetime, AbortSignal.timeout(retryDelay)]);
			// oxlint-disable-next-line no-await-in-loop -- Back off between rounds of connection attempts.
			await new Promise<void>((resolve) => {
				backoff.addEventListener('abort', () => resolve(), { once: true });
			});
		}
	}
}

/** Keeps just the latest good frame on a canvas, whether it is displayed directly or used as a texture. */
export function useCameraFeed({
	surface,
	urls,
	reconnecting = false,
	rotation = 0,
	enabled = true,
	onFrame,
}: {
	surface: () => HTMLCanvasElement;
	urls: readonly string[] | undefined;
	reconnecting?: boolean;
	rotation?: number;
	enabled?: boolean;
	onFrame?: (surface: HTMLCanvasElement | undefined) => void;
}) {
	const [status, setStatus] = useState<FeedStatus>('loading');
	const [allowPrompt, setAllowPrompt] = useState(false);
	const getSurface = useEffectEvent(surface);
	const advertised = useEffectEvent(() => (reconnecting ? [] : (urls ?? [])));
	const canPlay = useEffectEvent((url: string, received: boolean) =>
		reconnecting ? received : urls?.includes(url) === true,
	);
	const getRotation = useEffectEvent(() => rotation);
	const frame = useEffectEvent((canvas: HTMLCanvasElement | undefined) => onFrame?.(canvas));

	useEffect(() => {
		if (!enabled) {
			return undefined;
		}
		const lifetime = new AbortController();
		void playCamera(
			getSurface(),
			lifetime.signal,
			allowPrompt,
			() => advertised(),
			(url, received) => canPlay(url, received),
			() => getRotation(),
			setStatus,
			(canvas) => frame(canvas),
		);
		return () => lifetime.abort();
	}, [allowPrompt, enabled]);

	return {
		status,
		requestAccess: () => {
			setStatus('loading');
			setAllowPrompt(true);
		},
	};
}
