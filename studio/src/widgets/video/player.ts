import * as stylex from '@stylexjs/stylex';
import type { Ref } from 'react';

/** Controls for a playing video, times in seconds */
export type Player = {
	/** The fastest playback rate the player supports */
	readonly maxRate: number;
	/** How long (s at 1x) the player can lag during continuous playback before seeking to catch up. */
	readonly playbackSeekTolerance?: number;
	/** The playback position, or the latest requested position while a seek is pending */
	time: () => number;
	/** The presented frame's time, `null` while waiting, `undefined` if this player can't drive playback. */
	playbackTime?: () => number | null | undefined;
	seek: (time: number) => void;
	play: () => void;
	pause: () => void;
	setRate: (rate: number) => void;
	/** A snapshot of the displayed frame, only available to players that own the video element */
	captureFrame?: () => HTMLCanvasElement | undefined;
};

/** What a player found out about its video */
export type PlayerInfo = {
	/** `undefined` until the video loads */
	readonly duration?: number | undefined;
	/** Why the video can't play, `undefined` while it can */
	readonly error?: { readonly title: string; readonly description: string } | undefined;
};

export type PlayerProps = {
	muted: boolean;
	ref: Ref<Player>;
	onInfo: (info: PlayerInfo) => void;
};

export const videoStyles = stylex.create({
	/** How a video fits its pane */
	fit: { width: '100%', height: '100%', objectFit: 'contain' },
});
