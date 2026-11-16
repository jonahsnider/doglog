import { describe, expect, test } from 'vite-plus/test';
import { Samples } from '@/data/samples';
import { countAtOrBefore, filterMessages, mergeMessages, messageLevel } from '@/widgets/console-messages';

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

	test('splits samples into lines, joining indented lines to the same source across samples', () => {
		const console = samplesOf(
			[10, 'Warning at Tracer.java:62: \tA.periodic(): 0.01s\n\tB.periodic(): 0.02s'],
			[30, '\tC.periodic(): 0.03s\n\nError at Main.java:9: Unhandled exception\n\tat Main.main(Main.java:9)'],
		);
		const messages = samplesOf([20, 'Enabled']);

		const merged = mergeMessages([console, messages]);

		expect(merged.texts).toEqual([
			'Warning at Tracer.java:62: \tA.periodic(): 0.01s\n\tB.periodic(): 0.02s\n\tC.periodic(): 0.03s',
			'Enabled',
			'Error at Main.java:9: Unhandled exception\n\tat Main.main(Main.java:9)',
		]);
		expect([...merged.times]).toEqual([10, 20, 30]);
		expect(merged.levels).toEqual(['warning', 'info', 'error']);
	});
});

test('messageLevel uses the prefixes WPILib prints', () => {
	expect(messageLevel('Error at Robot.java:12: Bad thing')).toBe('error');
	expect(messageLevel('Exception in thread "main" java.lang.RuntimeException')).toBe('error');
	expect(messageLevel('Warning at IterativeRobotBase.java:436: Loop time of 0.02s overrun')).toBe('warning');
	expect(messageLevel('CommandScheduler loop overrun')).toBe('warning');
	expect(messageLevel('NT: Got a NT4 connection')).toBe('info');
	expect(messageLevel('No Error at all')).toBe('info');
});

test('filterMessages ignores case', () => {
	const merged = mergeMessages([samplesOf([10, 'CAN bus error'], [20, 'Loop overrun'], [30, 'can timeout'])]);

	const filtered = filterMessages(merged, 'CAN', 'info');

	expect(filtered.texts).toEqual(['CAN bus error', 'can timeout']);
	expect([...filtered.times]).toEqual([10, 30]);
});

test('filterMessages hides messages below the minimum level', () => {
	const merged = mergeMessages([
		samplesOf([10, 'Robot started'], [20, 'Warning at A.java:1: slow'], [30, 'Error at B.java:2: broken']),
	]);

	expect(filterMessages(merged, '', 'warning').levels).toEqual(['warning', 'error']);
	expect(filterMessages(merged, '', 'error').texts).toEqual(['Error at B.java:2: broken']);
});

test('countAtOrBefore includes messages at the time', () => {
	const merged = mergeMessages([samplesOf([10, 'a'], [20, 'b'], [20, 'c'], [30, 'd'])]);

	expect(countAtOrBefore(merged, 5)).toBe(0);
	expect(countAtOrBefore(merged, 20)).toBe(3);
	expect(countAtOrBefore(merged, 100)).toBe(4);
});
