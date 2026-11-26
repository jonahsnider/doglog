// Fading lines in and out as they're shown, hidden, and muted, so they don't pop
import { cubicBezier } from 'motion';
import { duration, easing, reducesMotion } from '@/lib/motion';

const fadeMs = duration.fast * 1000;
const ease = cubicBezier(...easing.standard);
/** How visible the lines of bindings other than the highlighted one stay, the design rules' dragged state opacity */
const mutedOpacity = 0.16;

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
 * Starts fading each line toward being shown, hidden, or muted when that changed, from wherever its fade is now. Lines
 * of bindings other than the `highlighted` one are muted while it has a shown line. New lines start as they are, and
 * lines change right away when reducing motion.
 */
export function updateFades(
	fades: Map<string, Fade>,
	lines: readonly { id: string; binding: string; hidden: boolean }[],
	highlighted: string | undefined,
	now: number,
): void {
	const reduceMotion = reducesMotion();
	const muting = lines.some((line) => line.binding === highlighted && !line.hidden);
	for (const line of lines) {
		const to = line.hidden ? 0 : muting && line.binding !== highlighted ? mutedOpacity : 1;
		const fade = fades.get(line.id);
		if (!fade || reduceMotion) {
			fades.set(line.id, { from: to, to, start: 0 });
		} else if (fade.to !== to) {
			fades.set(line.id, { from: opacityAt(fade, now), to, start: now });
		}
	}
}
