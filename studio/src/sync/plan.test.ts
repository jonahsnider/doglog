import { describe, expect, test } from 'vite-plus/test';
import { type RemoteLog, type SyncFilter, planSync } from './plan.ts';

const now = Date.parse('2026-03-20T12:00:00Z');
const noFilter: SyncFilter = { days: 30, officialOnly: false, capBytes: undefined };

function remote(name: string, size: number): RemoteLog {
	return { path: `/U/logs/${name}`, name, size };
}

const practice = 'FRC_20260318_090000.wpilog';
const qual = 'FRC_20260319_143000_CAPH_Q12.wpilog';
const current = 'FRC_20260320_110000.wpilog';
const old = 'FRC_20250315_143000_CAPH_Q12.wpilog';

test('downloads new logs newest first', () => {
	const plan = planSync([remote(practice, 100), remote(current, 300), remote(qual, 200)], [], noFilter, now);
	expect(plan.downloads.map(({ log, offset }) => [log.name, offset])).toEqual([
		[current, 0],
		[qual, 0],
		[practice, 0],
	]);
	expect(plan.deletions).toEqual([]);
});

test('downloads the parts of a split log newest first', () => {
	const parts = [qual, qual.replace('.wpilog', '.2.wpilog'), qual.replace('.wpilog', '.10.wpilog')];
	const plan = planSync(
		parts.map((name) => remote(name, 100)),
		[],
		{ ...noFilter, officialOnly: true },
		now,
	);
	expect(plan.downloads.map(({ log }) => log.name)).toEqual(parts.toReversed());
});

test('skips logs that are already synced and resumes ones that grew', () => {
	const plan = planSync(
		[remote(practice, 100), remote(current, 300)],
		[
			{ name: practice, size: 100 },
			{ name: current, size: 120 },
		],
		noFilter,
		now,
	);
	expect(plan.downloads.map(({ log, offset }) => [log.name, offset])).toEqual([[current, 120]]);
});

test('ignores logs without a recognized name', () => {
	const plan = planSync(
		[remote('FRC_TBD_3f2a9c0d1e4b5a6c.wpilog', 100), remote('match.wpilog', 100)],
		[{ name: 'match.wpilog', size: 100 }],
		{ ...noFilter, capBytes: 0 },
		now,
	);
	expect(plan).toEqual({ downloads: [], deletions: [], logs: [] });
});

describe('filter', () => {
	test('skips logs older than the number of days', () => {
		const plan = planSync([remote(old, 100), remote(practice, 100)], [], { ...noFilter, days: 14 }, now);
		expect(plan.downloads.map(({ log }) => log.name)).toEqual([practice]);
	});

	test('only official matches', () => {
		const plan = planSync([remote(qual, 100), remote(practice, 100)], [], { ...noFilter, officialOnly: true }, now);
		expect(plan.downloads.map(({ log }) => log.name)).toEqual([qual]);
	});

	test("doesn't delete or keep downloading logs that no longer pass", () => {
		const plan = planSync(
			[remote(practice, 300)],
			[{ name: practice, size: 100 }],
			{ ...noFilter, officialOnly: true },
			now,
		);
		expect(plan.downloads).toEqual([]);
		expect(plan.deletions).toEqual([]);
		expect(plan.logs.map(({ name, state }) => [name, state])).toEqual([[practice, 'synced']]);
	});
});

describe('storage limit', () => {
	test('keeps the newest logs that fit and deletes older ones', () => {
		const plan = planSync(
			[remote(current, 300), remote(qual, 200), remote(practice, 100)],
			[
				{ name: qual, size: 200 },
				{ name: practice, size: 100 },
				{ name: old, size: 50 },
			],
			{ ...noFilter, capBytes: 550 },
			now,
		);
		expect(plan.downloads.map(({ log }) => log.name)).toEqual([current]);
		expect(plan.deletions).toEqual([practice, old]);
		expect(plan.logs.map(({ name, state }) => [name, state])).toEqual([
			[current, 'queued'],
			[qual, 'synced'],
		]);
	});

	test('shows logs that would be synced if they fit', () => {
		const plan = planSync([remote(current, 300), remote(qual, 200)], [], { ...noFilter, capBytes: 400 }, now);
		expect(plan.logs.map(({ name, state }) => [name, state])).toEqual([
			[current, 'queued'],
			[qual, 'over-limit'],
		]);
	});

	test("doesn't download logs that would be deleted", () => {
		const plan = planSync([remote(current, 300), remote(qual, 200)], [], { ...noFilter, capBytes: 400 }, now);
		expect(plan.downloads.map(({ log }) => log.name)).toEqual([current]);
		// Running again after the download makes the same choice, so nothing is downloaded and deleted over and over
		const next = planSync(
			[remote(current, 300), remote(qual, 200)],
			[{ name: current, size: 300 }],
			{ ...noFilter, capBytes: 400 },
			now,
		);
		expect(next.downloads).toEqual([]);
		expect(next.deletions).toEqual([]);
	});

	test('counts logs that are only on this computer', () => {
		const plan = planSync([remote(current, 300)], [{ name: qual, size: 200 }], { ...noFilter, capBytes: 400 }, now);
		expect(plan.downloads.map(({ log }) => log.name)).toEqual([current]);
		expect(plan.deletions).toEqual([qual]);
	});

	test('never deletes files with other names', () => {
		const plan = planSync([], [{ name: 'notes.wpilog', size: 1000 }], { ...noFilter, capBytes: 0 }, now);
		expect(plan.deletions).toEqual([]);
	});
});
