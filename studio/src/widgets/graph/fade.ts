// Fading lines in and out as they're shown and hidden, so they don't pop
import { cubicBezier } from 'motion';
import { duration, easing, reducesMotion } from '@/lib/motion';

const fadeMs = duration.fast * 1000;
const ease = cubicBezier(...easing.standard);

/** A line's opacity heading from `from` to `to` since `start` */
export type Fade = { from: number; to: number; start: number };

export function opacityAt(fade: Fade, now: number): number {
	const progress = Math.min((now - fade.start) / fadeMs, 1);
	return fade.from + (fade.to - fade.from) * ease(progress);
}

export function isFading(fade: Fade, now: number): boolean {
	return now - fade.start < fadeMs;
}

/**
 * Starts fading each line toward being shown or hidden when that changed, from wherever its fade is now. New lines start
 * as they are, and lines are shown or hidden right away when reducing motion.
 */
export function updateFades(
	fades: Map<string, Fade>,
	lines: readonly { id: string; hidden: boolean }[],
	now: number,
): void {
	const reduceMotion = reducesMotion();
	for (const line of lines) {
		const to = line.hidden ? 0 : 1;
		const fade = fades.get(line.id);
		if (!fade || reduceMotion) {
			fades.set(line.id, { from: to, to, start: 0 });
		} else if (fade.to !== to) {
			fades.set(line.id, { from: opacityAt(fade, now), to, start: now });
		}
	}
}
