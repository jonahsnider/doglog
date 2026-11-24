import { type RefObject, useEffect } from 'react';
import { getTimeRange } from '@/data/data-store';
import { type PlaybackClock, registerPlaybackVideo } from '@/timeline/playback-clock';
import { getTimeline, subscribeTimeline } from '@/timeline/timeline';
import type { Player } from '@/widgets/video/player';
import { type Sync, videoTimeAt } from '@/widgets/video/source';
import { frameLength } from '@/widgets/video/state';

/** The cursor's time (s since the source's start), `undefined` until the source has data */
export function timelineTimeAt(cursor: number | undefined): number | undefined {
	const range = getTimeRange();
	return cursor === undefined || range === undefined ? undefined : (cursor - range.start) / 1_000_000;
}

/** How often (ms) a video playing faster than it can catches up to the cursor */
const catchUpInterval = 250;

/** Keeps a video on the moment lined up with the cursor while `active`, playing along while the timeline plays */
export function useFollowCursor(
	player: RefObject<Player | null>,
	sync: Sync,
	duration: number | undefined,
	active: boolean,
): void {
	const { log: syncLog, video: syncVideo } = sync;
	useEffect(() => {
		const controls = player.current;
		const read = controls?.playbackTime;
		const start = Math.round((syncLog - syncVideo) * 1_000_000);
		const clock: PlaybackClock | undefined =
			active && controls && read && duration !== undefined && Number.isFinite(duration)
				? {
						range: { start, end: start + Math.round(duration * 1_000_000) },
						maxRate: controls.maxRate,
						read: () => {
							const time = read();
							return typeof time === 'number' ? start + Math.round(time * 1_000_000) : time;
						},
					}
				: undefined;
		const unregister = registerPlaybackVideo(clock);
		if (!active || !controls) {
			return unregister;
		}
		let lastCatchUp = 0;
		let lastSeekRevision = getTimeline().seekRevision;
		let wasDriving = false;
		const follow = () => {
			const { time, playback, playbackRate, seekRevision, playbackClock } = getTimeline();
			const cursor = timelineTimeAt(time);
			if (cursor === undefined) {
				return;
			}
			const sought = seekRevision !== lastSeekRevision;
			lastSeekRevision = seekRevision;
			const driving = clock !== undefined && playbackClock === clock;
			const align = sought || (driving && !wasDriving);
			wasDriving = driving;
			const wanted = videoTimeAt(cursor, { log: syncLog, video: syncVideo });
			const shown = Math.min(Math.max(wanted, 0), duration ?? Infinity);
			const inVideo =
				wanted >= 0 && (duration === undefined || Math.round(wanted * 1_000_000) < Math.round(duration * 1_000_000));
			const drift = Math.abs(shown - controls.time());
			if (playback === 'playing' && inVideo && playbackRate <= controls.maxRate) {
				controls.setRate(playbackRate);
				controls.play();
				// Once the video drives the cursor, only a user seek or clock handoff should seek it back.
				if (driving && !align && read?.() !== undefined) {
					return;
				}
				const tolerance = align
					? frameLength / 2
					: Math.max(0.25, (controls.playbackSeekTolerance ?? 0.25) * playbackRate);
				if (drift > tolerance) {
					controls.seek(shown);
				}
				return;
			}

			controls.pause();
			const now = performance.now();
			// Too fast for the player, show where the cursor is a few times a second
			const catchingUp = playback === 'playing' && inVideo;
			if (drift > frameLength / 2 && (sought || !catchingUp || now - lastCatchUp > catchUpInterval)) {
				lastCatchUp = now;
				controls.seek(shown);
			}
		};
		follow();
		const unsubscribe = subscribeTimeline(follow);
		return () => {
			unsubscribe();
			unregister();
			controls.pause();
		};
	}, [player, active, syncLog, syncVideo, duration]);
}
