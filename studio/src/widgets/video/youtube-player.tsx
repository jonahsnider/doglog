import { useEffect, useEffectEvent, useImperativeHandle, useRef, useState } from 'react';
import {
	colorVars,
	fontWeightVars,
	radiusVars,
	spacingVars,
	typeScaleVars,
} from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import * as z from 'zod';
import { type Player, type PlayerInfo, type PlayerProps, videoStyles } from '@/widgets/video/player';

// YouTube only plays videos embedded by a website, which the desktop app's pages aren't on, see `youtube-player.html`
const playerPage =
	STUDIO_DESKTOP && !import.meta.env.DEV ? 'https://doglog.studio/youtube-player.html' : '/youtube-player.html';
const playerOrigin = new URL(playerPage, location.href).origin;

const styles = stylex.create({
	frame: { pointerEvents: 'none', borderWidth: 0 },
	thumbnail: { position: 'absolute', inset: 0, display: 'block' },
	badge: {
		position: 'absolute',
		bottom: spacingVars['--spacing-2'],
		left: spacingVars['--spacing-2'],
		paddingInline: spacingVars['--spacing-1-5'],
		paddingBlock: spacingVars['--spacing-0-5'],
		borderRadius: radiusVars['--radius-element'],
		backgroundColor: colorVars['--color-background-surface'],
		fontSize: typeScaleVars['--text-supporting-size'],
		fontWeight: fontWeightVars['--font-weight-medium'],
		lineHeight: '1rem',
	},
});

/** How often (ms) a YouTube video can seek, it fetches the video again each time */
const seekInterval = 150;

/** What the player page sends, see `youtube-player.html` */
const messageSchema = z.discriminatedUnion('type', [
	z.object({ source: z.literal('doglog-youtube'), type: z.literal('ready') }),
	z.object({
		source: z.literal('doglog-youtube'),
		type: z.literal('status'),
		time: z.number(),
		duration: z.number(),
		state: z.number(),
		rate: z.number(),
	}),
	z.object({ source: z.literal('doglog-youtube'), type: z.literal('error'), code: z.number() }),
]);

function youTubeError(code: number): NonNullable<PlayerInfo['error']> {
	switch (code) {
		case 2: {
			return { title: "This YouTube video doesn't exist", description: 'Check the link and paste it again.' };
		}
		case 100: {
			return { title: 'This YouTube video is private or was removed', description: 'Try another video of the match.' };
		}
		case 101:
		case 150: {
			return {
				title: "This YouTube video can't play in Studio",
				description: "The video's owner only lets it play on YouTube.",
			};
		}
		default: {
			return { title: "YouTube couldn't play this video", description: 'Try opening it on YouTube.' };
		}
	}
}

/** Controls `youtube-player.html` in `frame` with messages, and follows what it reports */
function createController() {
	let frame: HTMLIFrameElement | null = null;
	let ready = false;
	let muted = true;
	// What Studio wants the player to do, applied again once the player is ready
	const wanted = { time: 0, playing: false, rate: 1 };
	// The player's last status, `at` is when it was reported (ms)
	let reported = { time: 0, at: 0, playing: false, rate: 1 };
	let lastSeek = 0;
	let seekTimer: ReturnType<typeof setTimeout> | undefined;

	const send = (message: Record<string, unknown>) => {
		if (ready) {
			frame?.contentWindow?.postMessage({ source: 'doglog-studio', ...message }, playerOrigin);
		}
	};
	const sendSeek = () => {
		lastSeek = performance.now();
		send({ type: 'seek', time: wanted.time });
	};

	const player: Player = {
		maxRate: 2,
		time: () =>
			reported.playing ? reported.time + ((performance.now() - reported.at) / 1000) * reported.rate : reported.time,
		seek: (time) => {
			wanted.time = time;
			reported = { ...reported, time, at: performance.now() };
			clearTimeout(seekTimer);
			const wait = lastSeek + seekInterval - performance.now();
			if (wait <= 0) {
				sendSeek();
			} else {
				seekTimer = setTimeout(sendSeek, wait);
			}
		},
		play: () => {
			if (!wanted.playing) {
				wanted.playing = true;
				send({ type: 'play' });
			}
		},
		pause: () => {
			if (wanted.playing) {
				wanted.playing = false;
				send({ type: 'pause' });
			}
		},
		setRate: (rate) => {
			if (wanted.rate !== rate) {
				wanted.rate = rate;
				send({ type: 'rate', rate });
			}
		},
	};

	return {
		player,
		setFrame: (element: HTMLIFrameElement | null) => {
			frame = element;
		},
		setMuted: (value: boolean) => {
			muted = value;
			send({ type: 'mute', muted });
		},
		/** Handles a message from the player page, reporting what it found out with `onInfo` */
		receive: (event: MessageEvent<unknown>, onInfo: (info: PlayerInfo) => void) => {
			const message = messageSchema.safeParse(event.data).data;
			if (event.source !== frame?.contentWindow || message === undefined) {
				return;
			}
			if (message.type === 'ready') {
				ready = true;
				send({ type: 'mute', muted });
				send({ type: 'rate', rate: wanted.rate });
				sendSeek();
				send({ type: wanted.playing ? 'play' : 'pause' });
			} else if (message.type === 'status') {
				// Statuses sent before the last seek arrived have the time from before it
				if (performance.now() - lastSeek > 300) {
					reported = { time: message.time, at: performance.now(), playing: message.state === 1, rate: message.rate };
				}
				if (message.duration > 0) {
					onInfo({ duration: message.duration });
				}
			} else {
				onInfo({ error: youTubeError(message.code) });
			}
		},
		stop: () => clearTimeout(seekTimer),
	};
}

/** Plays a YouTube video, controlled through `youtube-player.html` */
export function YouTubePlayer({ id, muted, ref, onInfo }: PlayerProps & { id: string }) {
	const [controller] = useState(createController);
	const frameRef = useRef<HTMLIFrameElement>(null);
	const [thumbnailLoaded, setThumbnailLoaded] = useState(false);
	useImperativeHandle(ref, () => controller.player, [controller]);

	const onMessage = useEffectEvent((event: MessageEvent<unknown>) => controller.receive(event, onInfo));
	useEffect(() => {
		controller.setFrame(frameRef.current);
		window.addEventListener('message', onMessage);
		return () => {
			window.removeEventListener('message', onMessage);
			controller.stop();
		};
	}, [controller]);

	useEffect(() => controller.setMuted(muted), [controller, muted]);

	const frame = stylex.props(videoStyles.fit, styles.frame);
	const thumbnail = stylex.props(styles.thumbnail);
	return (
		<>
			{/* oxlint-disable-next-line react/iframe-missing-sandbox -- YouTube's player needs scripts and its own origin, which leaves a sandbox nothing to limit */}
			<iframe
				ref={frameRef}
				title="YouTube video"
				src={`${playerPage}?v=${encodeURIComponent(id)}`}
				allow="autoplay; encrypted-media"
				referrerPolicy="strict-origin-when-cross-origin"
				// Clicks go to the widget, which plays and pauses Studio
				className={`${frame.className} saving-video-invisible`}
			/>
			{/* YouTube can't show a given frame on time, so saved videos show its thumbnail instead */}
			<div className={`${thumbnail.className} saving-video-only`}>
				<img
					src={`https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`}
					alt=""
					data-capture-pending={thumbnailLoaded ? undefined : ''}
					{...stylex.props(videoStyles.fit)}
					onLoad={() => setThumbnailLoaded(true)}
					onError={() => setThumbnailLoaded(true)}
				/>
				<span {...stylex.props(styles.badge)}>YouTube video</span>
			</div>
		</>
	);
}
