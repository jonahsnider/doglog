import { expect, test } from 'vite-plus/test';
import { createSamples, type Samples } from '@/data/samples';
import { stepLine } from '@/widgets/graph/decimate';
import { formatTick, timeTicks } from '@/widgets/graph/ticks';
import { fitRange, zoomedSpan } from '@/widgets/graph/y-range';

function samples(points: [time: number, value: number][]): Samples {
	const result = createSamples('number');
	for (const [time, value] of points) {
		result.push(time, value);
	}
	return result;
}

test('sparse samples are kept as is, starting from the held value before the view and holding the last one', () => {
	const line = stepLine(
		samples([
			[0, 1],
			[10, 2],
			[20, 3],
		]),
		{ start: 5, end: 30 },
		1000,
		25,
	);
	expect(line.xs).toEqual([0, 10, 20, 25]);
	expect(line.ys).toEqual([1, 2, 3, 3]);
	// The held point at the end isn't a logged sample
	expect(line.samples).toEqual([0, 1, 2]);
});

test("dense samples keep each pixel column's spike", () => {
	const points: [number, number][] = Array.from({ length: 1000 }, (_, index) => [index, 0]);
	points[500] = [500, 100];
	const line = stepLine(samples(points), { start: 0, end: 1000 }, 10, 1000);
	expect(Math.max(...line.ys.map(Number))).toBe(100);
	expect(line.samples).toEqual([]);
	// About four points per column, with up to two columns per pixel, instead of 1000 samples
	expect(line.xs.length).toBeLessThanOrEqual(85);
});

function pointsBetween(line: { xs: number[]; ys: (number | null)[] }, start: number, end: number) {
	return line.xs.map((x, index) => [x, line.ys[index]!]).filter(([x]) => x! >= start && x! < end);
}

test('lines break where the live session was disconnected, and stop at a gap with nothing after it', () => {
	const points = samples([
		[0, 1],
		[10, 2],
		[30, 3],
	]);
	const gaps = [
		{ start: 15, end: 30 },
		{ start: 35, end: 45 },
	];
	const line = stepLine(points, { start: 0, end: 50 }, 1000, 50, undefined, gaps);
	expect(line.xs).toEqual([0, 10, 15, 15, 30, 35, 35]);
	expect(line.ys).toEqual([1, 2, 2, null, 3, 3, null]);
});

test("dense samples are thinned the same way after panning, so the line doesn't wobble", () => {
	const points: [number, number][] = Array.from({ length: 10_000 }, (_, index) => [index, Math.sin(index)]);
	const before = stepLine(samples(points), { start: 1000, end: 6000 }, 100, 10_000);
	const after = stepLine(samples(points), { start: 1010, end: 6010 }, 100, 10_000);
	expect(pointsBetween(after, 1100, 5900)).toEqual(pointsBetween(before, 1100, 5900));
});

test('ticks are spaced so labels fit, aligned to the start of the source', () => {
	expect(timeTicks({ start: 1_000_000, end: 11_000_000 }, 1_000_000, 500)).toEqual({
		times: [1_000_000, 3_000_000, 5_000_000, 7_000_000, 9_000_000, 11_000_000],
		spacing: 2_000_000,
	});
	expect(formatTick(66_000_000, 1_000_000, 5_000_000)).toBe('1:05');
	expect(formatTick(3_500_000, 1_000_000, 500_000)).toBe('0:02.5');
});

test('the y-axis never zooms in past a share of the range across the whole source', () => {
	// Noise around 0 in an entry that reaches 3000 elsewhere stays a flat line
	const [min, max] = fitRange([-0.001, 0.001], [-0.001, 3000]);
	expect(max - min).toBeGreaterThan(150);
	// An entry that's small everywhere is still fit closely
	const [smallMin, smallMax] = fitRange([-0.001, 0.001], [-0.002, 0.002]);
	expect(smallMax - smallMin).toBeLessThan(0.003);
});

test('zooming a y-axis stops before its labels would run out of precision or grow huge', () => {
	const fitted: [number, number] = [1e9, 1e9 + 2];
	let span = 2;
	for (let step = 0; step < 1000; step++) {
		span = zoomedSpan([1e9, 1e9 + span], 0.5, fitted);
	}
	// Near 1e9, ticks across a thousandth of the fitted range would be too close together for doubles to tell apart
	expect(span).toBe(1);

	expect(zoomedSpan([0, 150], 2, [0, 2])).toBe(200);
	// Already zoomed out further than that, ex. before zooming into time, it doesn't jump in
	expect(zoomedSpan([0, 1000], 2, [0, 2])).toBe(1000);
	expect(zoomedSpan([0, 1000], 0.5, [0, 2])).toBe(500);
});
