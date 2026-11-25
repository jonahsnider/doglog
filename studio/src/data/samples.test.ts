import { describe, expect, test } from 'vite-plus/test';
import { findEntry, Samples, trimOldest } from '@/data/samples';

function samplesOf(...items: [number, number][]): Samples {
	const samples = new Samples();
	for (const [timestamp, value] of items) {
		samples.push(timestamp, value);
	}
	return samples;
}

describe('Samples', () => {
	test('valueAt returns the latest value at or before the time', () => {
		const samples = samplesOf([10, 3], [20, 5]);

		expect(samples.valueAt(5)).toBeUndefined();
		expect(samples.valueAt(10)).toBe(3);
		expect(samples.valueAt(15)).toBe(3);
		expect(samples.valueAt(20)).toBe(5);
		expect(samples.valueAt(100)).toBe(5);
	});

	test('range lookups handle repeated timestamps', () => {
		const samples = samplesOf([10, 0], [20, 1], [20, 2], [30, 3]);

		expect(samples.indexAtOrBefore(20)).toBe(2);
		expect(samples.indexAtOrAfter(20)).toBe(1);
		expect(samples.indexAtOrAfter(31)).toBe(4);
		expect(samples.indexAtOrBefore(9)).toBe(-1);
	});

	test('out of order samples are inserted in time order', () => {
		const samples = samplesOf([10, 1], [30, 3], [20, 2], [5, 0]);

		expect([...samples.timestamps.subarray(0, samples.length)]).toEqual([5, 10, 20, 30]);
		expect(samples.values).toEqual([0, 1, 2, 3]);
	});

	test('grows past its initial capacity', () => {
		const samples = new Samples(new Float64Array(1));
		for (let i = 0; i < 100; i++) {
			samples.push(i, i);
		}

		expect(samples).toHaveLength(100);
		expect(samples.valueAt(42.5)).toBe(42);
	});
});

const timestampsOf = (samples: Samples) => [...samples.timestamps.subarray(0, samples.length)];

describe('trimOldest', () => {
	test('removes the oldest samples across entries first', () => {
		const a = samplesOf([10, 0], [20, 0], [30, 0], [40, 0]);
		const b = samplesOf([15, 0], [25, 0], [35, 0]);

		expect(trimOldest([a, b], 3)).toBe(3);
		expect(timestampsOf(a)).toEqual([30, 40]);
		expect(timestampsOf(b)).toEqual([25, 35]);
	});

	test('keeps the value at the cutoff time', () => {
		const a = samplesOf([0, 1], [100, 2]);
		const b = samplesOf([10, 0], [20, 0], [30, 0], [40, 0]);

		trimOldest([a, b], 2);

		// `a` was 1 from 0 to 100, it must still be known after the cutoff
		expect(a.valueAt(50)).toBe(1);
	});

	test('always keeps the latest value of every entry', () => {
		const old = samplesOf([0, 7]);
		const busy = samplesOf([10, 0], [20, 1], [30, 2]);

		trimOldest([old, busy], 100);

		expect(old.valueAt(1000)).toBe(7);
		expect(busy.valueAt(1000)).toBe(2);
		expect(busy).toHaveLength(1);
	});
});

test('findEntry finds NetworkTables topics with or without the prefix logs record them under', () => {
	const recorded = new Map([
		['/NT:/FMSInfo/EventName', 'recorded'],
		['/Robot/Pose', 'logged'],
		['/NT:/Robot/Pose', 'published'],
	]);
	expect(findEntry(recorded, '/FMSInfo/EventName')).toBe('recorded');
	expect(findEntry(new Map([['/FMSInfo/EventName', 'live']]), '/NT:/FMSInfo/EventName')).toBe('live');
	// A log with both keeps them apart
	expect(findEntry(recorded, '/Robot/Pose')).toBe('logged');
	expect(findEntry(recorded, '/NT:/Robot/Pose')).toBe('published');
	// Only the whole `/NT:` segment is a prefix
	expect(findEntry(new Map([['/NT:Other/Value', 'other']]), '/Other/Value')).toBeUndefined();
	expect(findEntry(recorded, '/Arm/Angle')).toBeUndefined();
});
