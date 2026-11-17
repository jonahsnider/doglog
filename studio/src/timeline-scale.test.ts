import { expect, test } from 'vite-plus/test';
import { createTimeScale } from './timeline-scale.ts';

test('without compressed spans, times are spread evenly', () => {
	const scale = createTimeScale(1000, 200, []);
	expect(scale.toPercent(1000)).toBe(0);
	expect(scale.toPercent(1050)).toBe(25);
	expect(scale.toPercent(1200)).toBe(100);
	expect(scale.toTime(25)).toBe(1050);
});

test('a compressed span takes a small fixed width and the rest of the time shares what is left', () => {
	// 100 µs of normal time, 800 µs compressed, 100 µs of normal time
	const scale = createTimeScale(0, 1000, [{ start: 100, end: 900 }]);
	expect(scale.toPercent(100)).toBeCloseTo(48.5);
	expect(scale.toPercent(900)).toBeCloseTo(51.5);
	expect(scale.toPercent(500)).toBeCloseTo(50);
	expect(scale.toPercent(1000)).toBe(100);
});

test('times survive a round trip through positions', () => {
	const scale = createTimeScale(0, 10_000, [
		{ start: 1000, end: 4000 },
		{ start: 5000, end: 9000 },
	]);
	for (const time of [0, 500, 1000, 2500, 4000, 4500, 5000, 7000, 9000, 10_000]) {
		expect(scale.toTime(scale.toPercent(time))).toBeCloseTo(time);
	}
});

test('many compressed spans share a capped width', () => {
	const spans = Array.from({ length: 40 }, (_, index) => ({ start: index * 100 + 10, end: index * 100 + 90 }));
	const scale = createTimeScale(0, 4000, spans);
	const compressedWidth = spans.reduce(
		(total, span) => total + scale.toPercent(span.end) - scale.toPercent(span.start),
		0,
	);
	expect(compressedWidth).toBeCloseTo(40);
});
