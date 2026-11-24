import type { Samples } from '@/data/samples';

export type Analysis = {
	readonly values: readonly number[];
	readonly count: number;
	readonly min: number;
	readonly max: number;
	readonly mean: number;
	readonly median: number;
	readonly p95: number;
	readonly p99: number;
};

function interpolate(start: number, end: number, fraction: number): number {
	if (fraction === 0) {
		return start;
	}
	const span = end - start;
	return Number.isFinite(span) ? start + span * fraction : start * (1 - fraction) + end * fraction;
}

function percentile(values: readonly number[], fraction: number): number {
	const position = (values.length - 1) * fraction;
	const lower = Math.floor(position);
	return interpolate(values[lower]!, values[Math.ceil(position)]!, position - lower);
}

function mean(values: readonly number[], min: number, max: number): number {
	if (min === max) {
		return min;
	}
	// Scale only when the sum could overflow. A power of two avoids rounding normal values.
	const count = values.length;
	const magnitude = Math.max(Math.abs(min), Math.abs(max));
	const scale = magnitude > Number.MAX_VALUE / count ? 2 ** Math.ceil(Math.log2(count)) : 1;
	let sum = 0;
	let correction = 0;
	for (const value of values) {
		const term = value / scale;
		const next = sum + term;
		// Keep the low bits lost to rounding, including when large values cancel out.
		correction += Math.abs(sum) >= Math.abs(term) ? sum - next + term : term - next + sum;
		sum = next;
	}
	return ((sum + correction) / count) * scale;
}

/**
 * Summarize finite scalar samples from index `start` (inclusive) through `end` (exclusive), after `convert`ing them,
 * ex. to another unit.
 */
export function analyzeSamples(
	samples: Samples,
	start: number,
	end: number,
	convert: (value: number) => number = (value) => value,
): Analysis | undefined {
	const values: number[] = [];
	for (let index = start; index < end; index++) {
		const value = samples.values[index];
		if (typeof value === 'number' && Number.isFinite(value)) {
			const converted = convert(value);
			if (Number.isFinite(converted)) {
				values.push(converted);
			}
		}
	}
	const count = values.length;
	if (count === 0) {
		return undefined;
	}
	values.sort((a, b) => a - b);
	const min = values[0]!;
	const max = values[count - 1]!;
	return {
		values,
		count,
		min,
		max,
		mean: mean(values, min, max),
		median: percentile(values, 0.5),
		p95: percentile(values, 0.95),
		p99: percentile(values, 0.99),
	};
}

function valueIndex(values: readonly number[], edge: number, afterEqual = false): number {
	let low = 0;
	let high = values.length;
	while (low < high) {
		const middle = low + Math.floor((high - low) / 2);
		const value = values[middle]!;
		if (value < edge || (afterEqual && value === edge)) {
			low = middle + 1;
		} else {
			high = middle;
		}
	}
	return low;
}

function binEdges(min: number, max: number, count: number): number[] {
	for (let binCount = Math.min(64, Math.ceil(Math.sqrt(count))); binCount > 1; binCount = Math.floor(binCount / 2)) {
		const edges = [min];
		for (let i = 1; i < binCount; i++) {
			const edge = interpolate(min, max, i / binCount);
			if (edge <= edges[i - 1]! || edge >= max) {
				// Very narrow domains may not have enough distinct representable edges.
				break;
			}
			edges.push(edge);
		}
		if (edges.length === binCount) {
			return [...edges, max];
		}
	}
	return [min, max];
}

export type Bin = { start: number; end: number; counts: number[] };

/**
 * Bins shared by every series, over `range` or all of their values. Counts and samples `outside` the range are per
 * series, in the order of `analyses`.
 */
export function histogramBins(
	analyses: readonly Analysis[],
	range?: readonly [number, number],
): { bins: Bin[]; outside: number[] } {
	const [min, max] = range ?? [
		Math.min(...analyses.map((analysis) => analysis.min)),
		Math.max(...analyses.map((analysis) => analysis.max)),
	];
	const inView = analyses.map(({ values }) => ({
		values,
		first: valueIndex(values, min),
		end: valueIndex(values, max, true),
	}));
	const outside = analyses.map((analysis, index) => analysis.count - inView[index]!.end + inView[index]!.first);
	const count = inView.reduce((total, series) => total + series.end - series.first, 0);
	if (count === 0) {
		return { bins: [{ start: min, end: max, counts: analyses.map(() => 0) }], outside };
	}
	const shown = inView.filter((series) => series.end > series.first);
	const lowest = Math.min(...shown.map((series) => series.values[series.first]!));
	if (shown.every((series) => series.values[series.end - 1] === lowest)) {
		return {
			bins: [{ start: lowest, end: lowest, counts: inView.map((series) => series.end - series.first) }],
			outside,
		};
	}

	const edges = binEdges(min, max, count);
	const bins: Bin[] = [];
	const binStarts = inView.map((series) => series.first);
	for (let i = 1; i < edges.length; i++) {
		const edge = edges[i]!;
		const counts = inView.map((series, index) => {
			// Compare against the same edges we display, rather than rounding an inferred bin index.
			const binEnd = i === edges.length - 1 ? series.end : valueIndex(series.values, edge);
			const binCount = binEnd - binStarts[index]!;
			binStarts[index] = binEnd;
			return binCount;
		});
		bins.push({ start: edges[i - 1]!, end: edge, counts });
	}
	return { bins, outside };
}
