import { useImperativeHandle, useRef } from 'react';
import { type Player, type PlayerProps, videoClassName } from '@/widgets/video/player';

/** Plays a video file at `url` */
export function LocalPlayer({ url, muted, ref, onInfo }: PlayerProps & { url: string }) {
	const videoRef = useRef<HTMLVideoElement>(null);
	// Where to seek once the current seek is done, so fast scrubbing doesn't queue up seeks
	const pendingSeek = useRef<number>(undefined);

	// Captures wait for the frame being seeked to. Set on the element right away, the seek event comes after a capture checks.
	const setPending = (pending: boolean) => {
		const video = videoRef.current;
		if (video) {
			if (pending) {
				video.dataset['capturePending'] = '';
			} else {
				delete video.dataset['capturePending'];
			}
		}
	};

	useImperativeHandle(
		ref,
		(): Player => ({
			// Chromium and WebKit play up to 16×, but the audio cuts out above 4× and fewer frames are decoded
			maxRate: 8,
			// Compare against the newest request so reversing a scrub can replace an already queued seek.
			time: () => pendingSeek.current ?? videoRef.current?.currentTime ?? 0,
			seek: (time) => {
				const video = videoRef.current;
				if (!video) {
					return;
				}
				// `seeking` can clear before `seeked` drains the queue. Replace the queued target even in that gap.
				if (video.seeking || pendingSeek.current !== undefined) {
					pendingSeek.current = time;
				} else if (video.currentTime !== time) {
					setPending(true);
					video.currentTime = time;
				}
			},
			play: () => {
				if (videoRef.current?.paused === true) {
					// Rejects when paused again before it starts
					videoRef.current.play().catch(() => undefined);
				}
			},
			pause: () => {
				if (videoRef.current?.paused === false) {
					videoRef.current.pause();
				}
			},
			setRate: (rate) => {
				if (videoRef.current && videoRef.current.playbackRate !== rate) {
					videoRef.current.playbackRate = rate;
				}
			},
			captureFrame: () => {
				const video = videoRef.current;
				if (
					!video ||
					video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
					video.seeking ||
					pendingSeek.current !== undefined
				) {
					return undefined;
				}
				const canvas = document.createElement('canvas');
				// Preserve small tags in wide shots without allocating a full-resolution buffer for very large videos.
				const scale = Math.min(1, 2560 / Math.max(video.videoWidth, video.videoHeight));
				canvas.width = Math.round(video.videoWidth * scale);
				canvas.height = Math.round(video.videoHeight * scale);
				const context = canvas.getContext('2d');
				if (context) {
					context.drawImage(video, 0, 0, canvas.width, canvas.height);
					return canvas;
				}
				return undefined;
			},
		}),
		[],
	);

	return (
		// oxlint-disable-next-line jsx-a11y/media-has-caption -- Match videos are the user's own files, which rarely have captions
		<video
			ref={videoRef}
			src={url}
			muted={muted}
			playsInline
			disablePictureInPicture
			preload="auto"
			data-capture-pending
			className={videoClassName}
			onLoadedMetadata={(event) => onInfo({ duration: event.currentTarget.duration })}
			onLoadedData={() => setPending(false)}
			onSeeked={({ currentTarget: video }) => {
				// A new seek can start before the previous seek's event arrives.
				if (video.seeking) {
					return;
				}
				const next = pendingSeek.current;
				pendingSeek.current = undefined;
				if (next === undefined || next === video.currentTime) {
					setPending(false);
				} else {
					video.currentTime = next;
				}
			}}
			onError={(event) => {
				setPending(false);
				const code = event.currentTarget.error?.code;
				onInfo({
					error:
						code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED || code === MediaError.MEDIA_ERR_DECODE
							? {
									title: "Studio can't play this video's format",
									description: 'Convert it to an MP4 video with H.264, which every browser can play.',
								}
							: { title: "Couldn't play the video", description: 'The file might have been moved or changed.' },
				});
			}}
		/>
	);
}
