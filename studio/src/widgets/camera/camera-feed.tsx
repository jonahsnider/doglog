import CameraIcon from 'lucide-react/icons/camera';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { cameraPermission, streamCamera } from '@/widgets/camera/stream';
import { WidgetEmpty } from '@/widgets/widget-empty';

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
) {
	const context = surface.getContext('2d')!;
	const clear = () => context.clearRect(0, 0, surface.width, surface.height);
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
				// oxlint-disable-next-line no-await-in-loop -- Only one stream should use the pane's canvas at a time.
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

export function CameraFeed({
	name,
	urls,
	reconnecting,
	rotation,
}: {
	name: string;
	urls: readonly string[] | undefined;
	reconnecting: boolean;
	rotation: number;
}) {
	const canvas = useRef<HTMLCanvasElement>(null);
	const [status, setStatus] = useState<FeedStatus>('loading');
	const [allowPrompt, setAllowPrompt] = useState(false);
	const advertised = useEffectEvent(() => (reconnecting ? [] : (urls ?? [])));
	const canPlay = useEffectEvent((url: string, received: boolean) =>
		reconnecting ? received : urls?.includes(url) === true,
	);
	const getRotation = useEffectEvent(() => rotation);

	useEffect(() => {
		const lifetime = new AbortController();
		void playCamera(
			canvas.current!,
			lifetime.signal,
			allowPrompt,
			() => advertised(),
			(url, received) => canPlay(url, received),
			() => getRotation(),
			setStatus,
		);
		return () => lifetime.abort();
	}, [allowPrompt]);

	return (
		<div className="relative flex h-full flex-col">
			<div className={cn('min-h-0 flex-1', status !== 'live' && 'hidden')}>
				<canvas ref={canvas} role="img" aria-label={`Live view from ${name}`} className="size-full object-contain" />
			</div>
			{status === 'live' ? (
				<div className="shrink-0" role="status">
					{reconnecting && <p className="px-2 py-1.5 text-xs text-muted-foreground">Reconnecting to robot data…</p>}
				</div>
			) : status === 'loading' || (reconnecting && !urls) ? (
				<div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
					<Spinner className="size-4" />
					{reconnecting ? 'Reconnecting to robot…' : 'Connecting to camera…'}
				</div>
			) : status === 'permission' ? (
				<WidgetEmpty
					icon={<CameraIcon aria-hidden />}
					title="Allow camera access"
					description="Your browser needs permission to reach the camera on your local network."
				>
					<Button
						variant="outline"
						size="sm"
						onClick={() => {
							setStatus('loading');
							setAllowPrompt(true);
						}}
					>
						Allow access
					</Button>
				</WidgetEmpty>
			) : (
				<WidgetEmpty
					icon={<CameraIcon aria-hidden />}
					title="Camera feed unavailable"
					description={
						STUDIO_DESKTOP
							? 'Check that the camera is connected. Studio will keep trying.'
							: status === 'denied'
								? 'Allow local network access in your browser’s site settings, or open Studio on desktop.'
								: 'Check the camera connection and local network permission, or open Studio on desktop.'
					}
				/>
			)}
		</div>
	);
}
