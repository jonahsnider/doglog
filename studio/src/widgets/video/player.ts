import type { Ref } from 'react';

/** Controls for a playing video, times in seconds */
export type Player = {
	/** The fastest playback rate the player supports */
	readonly maxRate: number;
	/** The playback position, or the latest requested position while a seek is pending */
	time: () => number;
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

/** How a video fits its pane */
export const videoClassName = 'size-full object-contain';
