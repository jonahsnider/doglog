// How each y-axis fits the data: to what's in view, but never zoomed in so far that tiny noise fills the graph
import { cubicBezier } from 'motion';
import type { Samples } from '@/data/samples';
import { duration, easing, reducesMotion } from '@/lib/motion';

export type Range = [min: number, max: number];

/** The y-axis spans at least this share of its entries' range across the whole source */
const minShare = 0.05;
/** Space above and below the data, as a share of the axis */
const padShare = 0.05;
/** Zooming out a y-axis stops at this many times the range that fits its data */
const maxZoomOut = 100;
/** Zooming in a y-axis stops at this share of the range that fits its data */
const maxZoomIn = 1e-3;
/** Zooming in also stops at this share of the axis's values, finer steps can't be told apart and the labels repeat */
const minRelativeSpan = 1e-9;
const animationMs = duration.fastMax * 1000;
const ease = cubicBezier(...easing.move);

type Extent = { first: number; checked: number; min: number; max: number };
const extents = new WeakMap<Samples, Extent>();

/**
 * The lowest and highest numbers in `samples`, updated as samples arrive. Starts over when the oldest samples were
 * dropped, ex. by a long live session.
 */
export function wholeExtent(samples: Samples): Range | undefined {
	const { timestamps, length } = samples;
	let extent = extents.get(samples);
	if (!extent || extent.first !== timestamps[0] || extent.checked > length) {
		extent = { first: timestamps[0] ?? 0, checked: 0, min: Infinity, max: -Infinity };
		extents.set(samples, extent);
	}
	for (let index = extent.checked; index < length; index++) {
		const value = samples.value(index);
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

/**
 * How much a y-axis showing `range` spans after zooming by `factor` (below 1 zooms in), limited around `fitted`, the
 * range that fits the data. An axis already past a limit, ex. after zooming into time, can still zoom back toward it.
 */
export function zoomedSpan(range: Range, factor: number, fitted: Range): number {
	const span = range[1] - range[0];
	const fittedSpan = fitted[1] - fitted[0];
	const min = Math.max(fittedSpan * maxZoomIn, Math.max(Math.abs(range[0]), Math.abs(range[1])) * minRelativeSpan);
	const max = fittedSpan * maxZoomOut;
	const next = span * factor;
	return factor > 1 ? Math.min(next, Math.max(span, max)) : Math.max(next, Math.min(span, min));
}

/** Eases an axis from the range it showed to a new one, instantly when reducing motion */
export function createRangeAnimation() {
	let from: Range | undefined;
	let to: Range | undefined;
	let start = 0;

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
			from = reducesMotion() ? undefined : at(now);
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
