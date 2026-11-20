import { getTimeRange, subscribeData } from '@/data/data-store';
import { getSource } from '@/data/source';
import { settingsStore } from '@/settings';
import { skip, skipSection } from '@/timeline/seek';
import { getTimeline, seek, subscribeTimeline, togglePlayback } from '@/timeline/timeline';

/** How far the OS's playback position can drift from the cursor before it's corrected (µs) */
const maxDrift = 100_000;

/** A silent WAV, browsers only send media keys to pages playing media, and ignore media shorter than 5 seconds */
function silentAudio(): HTMLAudioElement {
	const sampleRate = 8000;
	const samples = sampleRate * 10;
	const view = new DataView(new ArrayBuffer(44));
	const ascii = (offset: number, text: string) =>
		new Uint8Array(view.buffer).set(new TextEncoder().encode(text), offset);
	ascii(0, 'RIFF');
	view.setUint32(4, 36 + samples, true);
	ascii(8, 'WAVEfmt ');
	view.setUint32(16, 16, true);
	// PCM, mono
	view.setUint16(20, 1, true);
	view.setUint16(22, 1, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate, true);
	// 8-bit samples
	view.setUint16(32, 1, true);
	view.setUint16(34, 8, true);
	ascii(36, 'data');
	view.setUint32(40, samples, true);

	// Unsigned 8-bit samples are silent at 128
	const audio = new Audio(
		URL.createObjectURL(new Blob([view, new Uint8Array(samples).fill(128)], { type: 'audio/wav' })),
	);
	audio.loop = true;
	return audio;
}

/** Let media keys and the OS's media controls play, pause, and seek logs while the media controls setting is on */
export function syncMediaSession(): void {
	if (!('mediaSession' in navigator)) {
		return;
	}
	const session = navigator.mediaSession;

	let audio: HTMLAudioElement | undefined;
	let active = false;
	// Pausing while the audio starts would stop it from starting
	let priming = false;
	// Position last given to the OS, which it moves forward on its own while playing
	let reported: { time: number; duration: number; at: number; rate: number } | undefined;

	const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
		[
			'play',
			() => {
				if (getTimeline().playback === 'paused') {
					togglePlayback();
				}
			},
		],
		[
			'pause',
			() => {
				if (getTimeline().playback === 'playing') {
					togglePlayback();
				}
			},
		],
		// Media keys send previous and next track, like chapters in a podcast app
		['previoustrack', () => skipSection(-1)],
		['nexttrack', () => skipSection(1)],
		// Some media controls show skip buttons instead
		['seekbackward', () => skip(-5)],
		['seekforward', () => skip(5)],
		[
			'seekto',
			({ seekTime }) => {
				const range = getTimeRange();
				if (seekTime !== undefined && range !== undefined) {
					seek(range.start + seekTime * 1_000_000);
				}
			},
		],
	];

	const activate = () => {
		active = true;
		audio ??= silentAudio();
		const source = getSource();
		session.metadata = new MediaMetadata({
			title: source?.type === 'log' ? source.fileName : 'Log',
			artist: 'DogLog Studio',
		});
		for (const [action, handler] of handlers) {
			session.setActionHandler(action, handler);
		}
		// The OS only shows the controls after the audio has played, so start it even if the log is paused
		priming = true;
		void audio
			.play()
			.catch(() => {
				// Autoplay was blocked, it starts the next time the user plays
			})
			.finally(() => {
				priming = false;
				if (!active || getTimeline().playback !== 'playing') {
					audio?.pause();
				}
			});
	};

	const deactivate = () => {
		active = false;
		reported = undefined;
		audio?.pause();
		session.metadata = null;
		session.playbackState = 'none';
		for (const [action] of handlers) {
			session.setActionHandler(action, null);
		}
	};

	const sync = () => {
		const { time, playback, speed, live } = getTimeline();
		const range = getTimeRange();
		if (!settingsStore.get().mediaControls || live || time === undefined || range === undefined) {
			if (active) {
				deactivate();
			}
			return;
		}
		if (!active) {
			activate();
		}

		const playing = playback === 'playing';
		if (playing && audio!.paused) {
			void audio!.play().catch(() => {
				// Autoplay was blocked, the log still plays
			});
		} else if (!playing && !audio!.paused && !priming) {
			audio!.pause();
		}
		session.playbackState = playing ? 'playing' : 'paused';

		// While playing, only correct the position when it drifts, ex. after a seek, since this runs every frame
		const rate = playing ? speed : 0;
		const duration = range.end - range.start;
		const now = performance.now();
		const outdated =
			reported === undefined ||
			reported.rate !== rate ||
			reported.duration !== duration ||
			(playing
				? Math.abs(time - (reported.time + (now - reported.at) * 1000 * rate)) > maxDrift
				: reported.time !== time);
		if (outdated) {
			reported = { time, duration, at: now, rate };
			session.setPositionState({
				duration: duration / 1_000_000,
				position: (time - range.start) / 1_000_000,
				// The OS keeps the position still while paused, and 0 isn't allowed
				playbackRate: speed,
			});
		}
	};

	sync();
	subscribeTimeline(sync);
	// The log's length grows while it loads
	subscribeData(sync);
	settingsStore.subscribe(sync);
}
