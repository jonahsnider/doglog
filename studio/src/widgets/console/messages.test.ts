import { describe, expect, test } from 'vite-plus/test';
import { Samples } from '@/data/samples';
import {
	countAtOrBefore,
	filterMessages,
	matchRanges,
	mergeMessages,
	messageLevel,
	type SearchOptions,
	searchPattern,
	stepTime,
} from '@/widgets/console/messages';

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

const plain: SearchOptions = { caseSensitive: false, wholeWord: false, regex: false };

test('filterMessages ignores case by default', () => {
	const merged = mergeMessages([samplesOf([10, 'CAN bus error'], [20, 'Loop overrun'], [30, 'can timeout'])]);

	const filtered = filterMessages(merged, searchPattern('CAN', plain), 'info');

	expect(filtered.texts).toEqual(['CAN bus error', 'can timeout']);
	expect([...filtered.times]).toEqual([10, 30]);
	expect([...filtered.ids]).toEqual([0, 2]);
});

test('filterMessages hides messages below the minimum level', () => {
	const merged = mergeMessages([
		samplesOf([10, 'Robot started'], [20, 'Warning at A.java:1: slow'], [30, 'Error at B.java:2: broken']),
	]);

	expect(filterMessages(merged, undefined, 'warning').levels).toEqual(['warning', 'error']);
	expect(filterMessages(merged, undefined, 'error').texts).toEqual(['Error at B.java:2: broken']);
});

function matches(text: string, query: string, options: Partial<SearchOptions> = {}): boolean {
	return searchPattern(query, { ...plain, ...options }).test(text);
}

describe('searchPattern', () => {
	test('matches special characters literally unless using a regular expression', () => {
		expect(matches('periodic(): 0.02s', 'periodic()')).toBe(true);
		expect(matches('a.b', 'a.b')).toBe(true);
		expect(matches('axb', 'a.b')).toBe(false);
		expect(matches('axb', 'a.b', { regex: true })).toBe(true);
	});

	test('matches case and whole words', () => {
		expect(matches('can timeout', 'CAN', { caseSensitive: true })).toBe(false);
		expect(matches('CANcoder', 'CAN', { wholeWord: true })).toBe(false);
		expect(matches('CAN bus', 'CAN', { wholeWord: true })).toBe(true);
		// Alternatives all need to be whole words
		expect(matches('CANcoder', 'CAN|bus', { wholeWord: true, regex: true })).toBe(false);
	});

	test('throws for an invalid regular expression', () => {
		expect(() => searchPattern('(', { ...plain, regex: true })).toThrow(SyntaxError);
	});
});

test('matchRanges finds every match, skipping empty ones', () => {
	expect(matchRanges('CAN bus can', searchPattern('can', plain))).toEqual([0, 3, 8, 11]);
	expect(matchRanges('aaaa', searchPattern('aa', plain))).toEqual([0, 2, 2, 4]);
	expect(matchRanges('ab', searchPattern('x*', { ...plain, regex: true }))).toEqual([]);
});

test('stepTime moves past every message at the same time', () => {
	const merged = mergeMessages([samplesOf([10, 'a'], [20, 'b'], [20, 'c'], [30, 'd'])]);

	expect(stepTime(merged, 5, 1)).toBe(10);
	expect(stepTime(merged, 25, 1)).toBe(30);
	expect(stepTime(merged, 30, 1)).toBeUndefined();
	expect(stepTime(merged, 25, -1)).toBe(10);
	expect(stepTime(merged, 10, -1)).toBeUndefined();
});

test('countAtOrBefore includes messages at the time', () => {
	const merged = mergeMessages([samplesOf([10, 'a'], [20, 'b'], [20, 'c'], [30, 'd'])]);

	expect(countAtOrBefore(merged, 5)).toBe(0);
	expect(countAtOrBefore(merged, 20)).toBe(3);
	expect(countAtOrBefore(merged, 100)).toBe(4);
});
