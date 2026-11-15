import { describe, expect, test } from 'vite-plus/test';
import { Samples } from '@/data/samples';
import { countAtOrBefore, filterMessages, mergeMessages } from '@/widgets/console-messages';

function samplesOf(...items: [number, string][]): Samples {
	const samples = new Samples();
	for (const [timestamp, value] of items) {
		samples.push(timestamp, value);
	}
	return samples;
}

describe('mergeMessages', () => {
	test('interleaves sources in time order, keeping source order for ties', () => {
		const console = samplesOf([10, 'a'], [30, 'c'], [30, 'd'], [50, 'f']);
		const messages = samplesOf([20, 'b'], [30, 'x'], [40, 'e']);

		const merged = mergeMessages([console, messages]);

		expect([...merged.times]).toEqual([10, 20, 30, 30, 30, 40, 50]);
		expect(merged.texts).toEqual(['a', 'b', 'c', 'd', 'x', 'e', 'f']);
	});

	test('handles empty sources', () => {
		expect(mergeMessages([]).texts).toEqual([]);
		expect(mergeMessages([new Samples(), samplesOf([5, 'a'])]).texts).toEqual(['a']);
	});
});

test('filterMessages ignores case', () => {
	const merged = mergeMessages([samplesOf([10, 'CAN bus error'], [20, 'Loop overrun'], [30, 'can timeout'])]);

	const filtered = filterMessages(merged, 'CAN');

	expect(filtered.texts).toEqual(['CAN bus error', 'can timeout']);
	expect([...filtered.times]).toEqual([10, 30]);
});

test('countAtOrBefore includes messages at the time', () => {
	const merged = mergeMessages([samplesOf([10, 'a'], [20, 'b'], [20, 'c'], [30, 'd'])]);

	expect(countAtOrBefore(merged, 5)).toBe(0);
	expect(countAtOrBefore(merged, 20)).toBe(3);
	expect(countAtOrBefore(merged, 100)).toBe(4);
});
