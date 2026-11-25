import { useEffect, useImperativeHandle, useRef } from 'react';
import * as stylex from '@stylexjs/stylex';
import { type Player, type PlayerProps, videoStyles } from '@/widgets/video/player';

const macDesktop = STUDIO_DESKTOP && navigator.userAgent.includes('Mac');

/** Plays a video file at `url` */
export function LocalPlayer({ url, muted, ref, onInfo }: PlayerProps & { url: string }) {
	const videoRef = useRef<HTMLVideoElement>(null);
	// Where to seek once the current seek is done, so fast scrubbing doesn't queue up seeks
	const pendingSeek = useRef<number>(undefined);
	const presentedTime = useRef<number>(undefined);

	useEffect(() => {
		presentedTime.current = undefined;
		const video = videoRef.current;
		if (!video?.requestVideoFrameCallback) {
			return undefined;
		}
		const onFrame: VideoFrameRequestCallback = (_, { mediaTime }) => {
			if (!video.seeking && pendingSeek.current === undefined) {
				presentedTime.current = mediaTime;
			}
			frame = video.requestVideoFrameCallback(onFrame);
		};
		let frame = video.requestVideoFrameCallback(onFrame);
		return () => video.cancelVideoFrameCallback(frame);
	}, []);

	// Captures wait for the frame being seeked to. Set on the element right away, the seek event comes after a capture checks.
	const setPending = (pending: boolean) => {
		const video = videoRef.current;
		if (video) {
			if (pending) {
				presentedTime.current = undefined;
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
			// The media clock can take several hundred milliseconds to start after play or seek.
			// Seeking again during that lag can restart the delay rather than catch up.
			playbackSeekTolerance: 0.75,
			// Compare against the newest request so reversing a scrub can replace an already queued seek.
			time: () => pendingSeek.current ?? videoRef.current?.currentTime ?? 0,
			playbackTime: () => {
				const video = videoRef.current;
				if (!video?.requestVideoFrameCallback || (video.paused && !video.ended)) {
					return undefined;
				}
				if (video.seeking || pendingSeek.current !== undefined) {
					return null;
				}
				return video.ended ? video.duration : (presentedTime.current ?? null);
			},
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
				const video = videoRef.current;
				if (video?.paused === false) {
					video.pause();
					// After playback the macOS desktop webview can stop presenting paused seeks. Reset its media state
					// without starting playback again, keeping the latest requested position across the reload.
					if (macDesktop) {
						const time = pendingSeek.current ?? video.currentTime;
						pendingSeek.current = undefined;
						setPending(true);
						video.load();
						video.currentTime = time;
					}
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
			{...stylex.props(videoStyles.fit)}
			onLoadedMetadata={(event) => onInfo({ duration: event.currentTarget.duration })}
			onLoadedData={({ currentTarget: video }) => {
				if (!video.seeking && pendingSeek.current === undefined) {
					setPending(false);
				}
			}}
			onSeeked={({ currentTarget: video }) => {
				const finishSeek = () => {
					// A new seek can start before the previous seek's event arrives.
					if (video !== videoRef.current || video.seeking) {
						return;
					}
					const next = pendingSeek.current;
					pendingSeek.current = undefined;
					if (next === undefined || next === video.currentTime) {
						setPending(false);
					} else {
						setPending(true);
						video.currentTime = next;
					}
				};
				if (macDesktop && video.paused && pendingSeek.current !== undefined) {
					// Give the webview a rendering turn when scrubbing, without delaying playback seeks.
					requestAnimationFrame(finishSeek);
				} else {
					finishSeek();
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
