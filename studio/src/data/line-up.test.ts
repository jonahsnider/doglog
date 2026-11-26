import { expect, test } from 'vite-plus/test';
import { DataSet } from '@/data/data-set';
import { lineUpOffset } from '@/data/line-up';

const s = 1_000_000;

/** A log with the robot enabled in auto and teleop for each `[auto start, auto end, teleop start, teleop end]` (s) */
function match(end: number, runs: readonly (readonly [number, number, number, number])[]): DataSet {
	const data = new DataSet(() => {});
	const enabled = data.addEntry('/DS:enabled', 'boolean');
	const autonomous = data.addEntry('/DS:autonomous', 'boolean');
	data.addSample(enabled, 0, false);
	data.addSample(autonomous, 0, false);
	for (const [autoStart, autoEnd, teleopStart, teleopEnd] of runs) {
		data.addSample(autonomous, autoStart * s, true);
		data.addSample(enabled, autoStart * s, true);
		data.addSample(enabled, autoEnd * s, false);
		data.addSample(autonomous, autoEnd * s, false);
		data.addSample(enabled, teleopStart * s, true);
		data.addSample(enabled, teleopEnd * s, false);
	}
	data.addSample(enabled, end * s, false);
	data.publish();
	return data;
}

test('lines up the start of auto of two matches', () => {
	const qual12 = match(300, [[136.94, 151.94, 154.94, 289.94]]);
	const qual13 = match(260, [[65.2, 80.2, 83.2, 218.2]]);
	expect(lineUpOffset(qual12, qual13)).toBeCloseTo((136.94 - 65.2) * s, -3);
});

test('lines up a run that went differently by its enables', () => {
	// Same auto, but the second robot's teleop started later and ran shorter
	const qual12 = match(200, [[30, 45, 48, 183]]);
	const qual13 = match(200, [[50, 65, 70, 150]]);
	expect(lineUpOffset(qual12, qual13)).toBeCloseTo(-20 * s, -3);
});

test('lines up starts when a log was never enabled', () => {
	const qual12 = match(200, [[30, 45, 48, 183]]);
	const bench = new DataSet(() => {});
	const voltage = bench.addEntry('/Battery', 'double');
	bench.addSample(voltage, 5 * s, 12);
	bench.addSample(voltage, 90 * s, 12);
	bench.publish();
	expect(lineUpOffset(qual12, bench)).toBe(-5 * s);
});

test('lines up with the latest enable', () => {
	const live = match(300, [
		[10, 25, 27, 40],
		[200, 215, 217, 230],
	]);
	const reference = match(60, [[5, 20, 22, 35]]);
	expect(lineUpOffset(live, reference, true)).toBeCloseTo(195 * s, -3);
});

test('lines up with the start when the base was never enabled', () => {
	const live = new DataSet(() => {});
	const voltage = live.addEntry('/Battery', 'double');
	live.addSample(voltage, 1000 * s, 12);
	live.publish();
	const reference = match(60, [[5, 20, 22, 35]]);
	expect(lineUpOffset(live, reference, true)).toBe(1000 * s);
});
