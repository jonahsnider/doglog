// How each y-axis fits the data: to what's in view, but never zoomed in so far that tiny noise fills the graph
import { cubicBezier } from 'motion';
import type { Samples } from '@/data/samples';
import { easing } from '@/lib/motion';

export type Range = [min: number, max: number];

/** The y-axis spans at least this share of its entries' range across the whole source */
const minShare = 0.05;
/** Space above and below the data, as a share of the axis */
const padShare = 0.05;
const animationMs = 200;
const ease = cubicBezier(...easing.inOut);

type Extent = { first: number; checked: number; min: number; max: number };
const extents = new WeakMap<Samples, Extent>();

/**
 * The lowest and highest numbers in `samples`, updated as samples arrive. Starts over when the oldest samples were
 * dropped, ex. by a long live session.
 */
export function wholeExtent(samples: Samples): Range | undefined {
	const { timestamps, values, length } = samples;
	let extent = extents.get(samples);
	if (!extent || extent.first !== timestamps[0] || extent.checked > length) {
		extent = { first: timestamps[0] ?? 0, checked: 0, min: Infinity, max: -Infinity };
		extents.set(samples, extent);
	}
	for (let index = extent.checked; index < length; index++) {
		const value = values[index];
		if (typeof value === 'number' && Number.isFinite(value)) {
			extent.min = Math.min(extent.min, value);
			extent.max = Math.max(extent.max, value);
		}
	}
	extent.checked = length;
	return extent.min <= extent.max ? [extent.min, extent.max] : undefined;
}

/** Fits `visible`, the range of the data in view, spanning at least a share of `whole`, the range across the source */
export function fitRange(visible: Range, whole: Range | undefined): Range {
	const [low, high] = visible;
	const minSpan = whole ? (whole[1] - whole[0]) * minShare : 0;
	const center = (low + high) / 2;
	const [min, max] = high - low < minSpan ? [center - minSpan / 2, center + minSpan / 2] : visible;
	const pad = max === min ? Math.abs(min) * 0.1 || 1 : (max - min) * padShare;
	return [min - pad, max + pad];
}

/** Eases an axis from the range it showed to a new one, instantly when the system is set to reduce motion */
export function createRangeAnimation() {
	let from: Range | undefined;
	let to: Range | undefined;
	let start = 0;
	const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

	const at = (now: number): Range | undefined => {
		if (!from || !to) {
			return to;
		}
		const progress = Math.min((now - start) / animationMs, 1);
		const eased = ease(progress);
		return [from[0] + (to[0] - from[0]) * eased, from[1] + (to[1] - from[1]) * eased];
	};

	return {
		/** The range to show now, heading to `target` */
		update(target: Range, now: number): Range {
			if (to && target[0] === to[0] && target[1] === to[1]) {
				return at(now)!;
			}
			from = reduceMotion.matches ? undefined : at(now);
			to = target;
			start = now;
			return at(now)!;
		},
		/** Whether the range is still changing, so another frame should be drawn */
		isAnimating(now: number): boolean {
			return from !== undefined && now - start < animationMs;
		},
	};
}
