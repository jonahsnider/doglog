import { type RefObject, useEffect } from 'react';
import { getTimeRange } from '@/data/data-store';
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
		if (!active) {
			return undefined;
		}
		let lastCatchUp = 0;
		const follow = () => {
			const controls = player.current;
			const { time, playback, speed } = getTimeline();
			const cursor = timelineTimeAt(time);
			if (!controls || cursor === undefined) {
				return;
			}
			const wanted = videoTimeAt(cursor, { log: syncLog, video: syncVideo });
			const shown = Math.min(Math.max(wanted, 0), duration ?? Infinity);
			const inVideo = wanted >= 0 && (duration === undefined || wanted < duration);
			const drift = Math.abs(controls.time() - shown);
			if (playback === 'playing' && inVideo && speed <= controls.maxRate) {
				controls.setRate(speed);
				controls.play();
				// Players drift a little, only seek when it shows
				if (drift > 0.25 * Math.max(1, speed)) {
					controls.seek(shown);
				}
				return;
			}

			controls.pause();
			const now = performance.now();
			// Too fast for the player, show where the cursor is a few times a second
			const catchingUp = playback === 'playing' && inVideo;
			if (drift > frameLength / 2 && (!catchingUp || now - lastCatchUp > catchUpInterval)) {
				lastCatchUp = now;
				controls.seek(shown);
			}
		};
		follow();
		const unsubscribe = subscribeTimeline(follow);
		const controls = player.current;
		return () => {
			unsubscribe();
			controls?.pause();
		};
	}, [player, active, syncLog, syncVideo, duration]);
}
