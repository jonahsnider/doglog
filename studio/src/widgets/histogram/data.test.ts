import { expect, test } from 'vite-plus/test';
import { Samples, type Value } from '@/data/samples';
import { analyzeSamples, histogramBins } from '@/widgets/histogram/data';

function samples(...values: Value[]): Samples {
	return new Samples(
		Float64Array.from(values, (_, index) => index),
		values,
	);
}

test('analyzes only finite numeric recordings in the index slice without dropping repeats', () => {
	const raw = samples(30, 20, 10, 10, Number.NaN, Infinity, -Infinity, '40', true, [30], 40);
	const analysis = analyzeSamples(raw, 1, 10);
	expect(analysis).toMatchObject({ values: [10, 10, 20], count: 3, min: 10, max: 20, median: 10 });
	expect(raw.values.slice(0, 4)).toEqual([30, 20, 10, 10]);
	expect(analyzeSamples(raw, 4, 10)).toBeUndefined();
	expect(analyzeSamples(raw, 1, 1)).toBeUndefined();
});

test('uses interpolated sample percentiles, including between the two middle samples', () => {
	const analysis = analyzeSamples(samples(60, 10, 20), 0, 3)!;
	expect(analysis).toMatchObject({ min: 10, max: 60, mean: 30, median: 20 });
	expect(analysis.p95).toBeCloseTo(56);
	expect(analysis.p99).toBeCloseTo(59.2);
	expect(analyzeSamples(samples(60, 10), 0, 2)?.median).toBe(35);
	expect(analyzeSamples(samples(20), 0, 1)).toMatchObject({ mean: 20, median: 20, p95: 20, p99: 20 });
});

test('converts recorded values before analyzing them', () => {
	const analysis = analyzeSamples(samples(0.01, 0.02, Number.NaN), 0, 3, (value) => value * 1000)!;
	expect(analysis).toMatchObject({ values: [10, 20], min: 10, max: 20, mean: 15 });
});

test('counts samples on interior edges in the next bin and includes both outer edges', () => {
	// Rounding a normalized bin index would put 0.5 in the first bin, but it is on the displayed edge.
	const justBelow = 0.5 - Number.EPSILON / 4;
	const analysis = analyzeSamples(samples(0.2, 0.4, justBelow, 0.5, 0.5, 0.7, 0.9, 1, 1.1), 0, 9)!;
	expect(histogramBins([analysis])).toEqual({
		bins: [
			{ start: 0.2, end: 0.5, counts: [3] },
			{ start: 0.5, end: 0.8, counts: [3] },
			{ start: 0.8, end: 1.1, counts: [3] },
		],
		outside: [0],
	});
});

test('bins every series on the same edges spanning all of them, counting each separately', () => {
	const low = analyzeSamples(samples(0, 1), 0, 2)!;
	const high = analyzeSamples(samples(3, 4), 0, 2)!;
	expect(histogramBins([low, high])).toEqual({
		bins: [
			{ start: 0, end: 2, counts: [2, 0] },
			{ start: 2, end: 4, counts: [0, 2] },
		],
		outside: [0, 0],
	});
	expect(histogramBins([low, high], [1, 3])).toEqual({
		bins: [
			{ start: 1, end: 2, counts: [1, 0] },
			{ start: 2, end: 3, counts: [0, 1] },
		],
		outside: [1, 1],
	});
});

test('recomputes bins over the requested value range and keeps the original summary', () => {
	const analysis = analyzeSamples(samples(-5, 0, 2, 4, 6, 100), 0, 6)!;
	expect(histogramBins([analysis], [0, 6])).toEqual({
		bins: [
			{ start: 0, end: 3, counts: [2] },
			{ start: 3, end: 6, counts: [2] },
		],
		outside: [2],
	});
	expect(histogramBins([analysis], [-1, 7])).toEqual({
		bins: [
			{ start: -1, end: 3, counts: [2] },
			{ start: 3, end: 7, counts: [2] },
		],
		outside: [2],
	});
	expect(analysis).toMatchObject({ count: 6, min: -5, max: 100 });
	expect(histogramBins([analysis]).outside).toEqual([0]);
});

test('shows a zero-width bin when every series in view has the same single value', () => {
	const constant = analyzeSamples(samples(20, 20, 20), 0, 3)!;
	expect(histogramBins([constant])).toEqual({ bins: [{ start: 20, end: 20, counts: [3] }], outside: [0] });
	const analysis = analyzeSamples(samples(10, 20, 20, 30), 0, 4)!;
	expect(histogramBins([analysis, constant], [20, 22])).toEqual({
		bins: [{ start: 20, end: 20, counts: [2, 3] }],
		outside: [2, 0],
	});
	expect(histogramBins([analysis], [22, 28])).toEqual({ bins: [{ start: 22, end: 28, counts: [0] }], outside: [4] });
});

test('keeps finite statistics and bin edges when the value span would overflow', () => {
	const max = Number.MAX_VALUE;
	const analysis = analyzeSamples(samples(-max, max, max, max), 0, 4)!;
	expect(analysis.mean).toBe(max / 2);
	expect(histogramBins([analysis]).bins).toEqual([
		{ start: -max, end: 0, counts: [1] },
		{ start: 0, end: max, counts: [3] },
	]);
	expect(analyzeSamples(samples(-max, max), 0, 2)?.median).toBe(0);
});

test('does not emit duplicate edges when no number lies between the extrema', () => {
	const next = 1 + Number.EPSILON;
	const analysis = analyzeSamples(samples(1, next, next), 0, 3)!;
	expect(histogramBins([analysis])).toEqual({ bins: [{ start: 1, end: next, counts: [3] }], outside: [0] });
});
