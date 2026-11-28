import { expect, test } from 'vite-plus/test';
import type { Listing } from './listing.ts';
import { isUploaded, mergeRuns, storageRuns } from './runs.ts';

const q18 = 'WPILIB_20270313_231204_CAPH_Q18.wpilog';
const q18Hoot = 'CAPH_Q18_rio_2027-03-13_23-12-04.hoot';
const q19 = 'WPILIB_20270313_233000_CAPH_Q19.wpilog';

function listing(files: [string, number][], json: Record<string, unknown> = {}): Listing {
	return { files: files.map(([path, size]) => ({ path, size, version: '1' })), json, at: 0 };
}

test('reads runs, videos, and YouTube links from the folders and their files', () => {
	const runs = storageRuns(
		listing(
			[
				['2027/CAPH/Q18/doglog.json', 1],
				[`2027/CAPH/Q18/${q18}`, 100],
				[`2027/CAPH/Q18/${q18Hoot}`, 50],
				['2027/CAPH/Q18/stands.mp4', 600],
				['2027/CAPH/Q18/stands.mp4.jpg', 1],
				['2027/CAPH/Q18/stands.mp4.doglog.json', 1],
				['2027/CAPH/Q18/Broadcast.doglog.json', 1],
				['2027/2027-03-13/Unsorted/phone.mov', 300],
			],
			{
				'2027/CAPH/Q18/doglog.json': { version: 1, duration: 154.2, logs: [q18, q18Hoot] },
				'2027/CAPH/Q18/stands.mp4.doglog.json': { version: 1, angle: 'Stands', offset: -3.42 },
				'2027/CAPH/Q18/Broadcast.doglog.json': {
					version: 1,
					angle: 'Broadcast',
					youtube: 'https://www.youtube.com/watch?v=abcdefghijk',
					offset: 12.5,
				},
			},
		),
	);

	const match = runs.find((run) => run.folder === '2027/CAPH/Q18')!;
	expect(match).toMatchObject({ match: 'CAPH Q18', kind: 'qualification', event: 'CAPH', duration: 154.2 });
	// Robot logs come before HOOT logs
	expect(match.logs.map((log) => log.name)).toEqual([q18, q18Hoot]);
	expect(match.videos).toEqual([
		{
			angle: 'Broadcast',
			offset: 12.5,
			youtube: 'https://www.youtube.com/watch?v=abcdefghijk',
			sidecar: '2027/CAPH/Q18/Broadcast.doglog.json',
		},
		{
			angle: 'Stands',
			offset: -3.42,
			file: '2027/CAPH/Q18/stands.mp4',
			poster: '2027/CAPH/Q18/stands.mp4.jpg',
			sidecar: '2027/CAPH/Q18/stands.mp4.doglog.json',
		},
	]);
	// A video without a log is a run of its own
	const unsorted = runs.find((run) => run.folder === '2027/2027-03-13/Unsorted/phone.mov')!;
	expect(unsorted.logs).toEqual([]);
	expect(unsorted.videos.map((video) => video.file)).toEqual(['2027/2027-03-13/Unsorted/phone.mov']);
});

test('merges local runs into storage runs by log name, even when moved in storage', () => {
	const stored = storageRuns(listing([[`misplaced/${q18}`, 100]]));
	const local = [
		{
			folder: '2027/CAPH/Q18',
			start: 0,
			match: 'CAPH Q18',
			kind: 'qualification' as const,
			event: 'CAPH',
			logs: [
				{ name: q18, size: 100, path: `/sync/2027/CAPH/Q18/${q18}` },
				{ name: q18Hoot, size: 50, path: `/sync/2027/CAPH/Q18/${q18Hoot}` },
			],
			videos: [],
		},
		{
			folder: '2027/CAPH/Q19',
			start: 1,
			match: 'CAPH Q19',
			kind: 'qualification' as const,
			event: 'CAPH',
			logs: [{ name: q19, size: 80, path: `/sync/2027/CAPH/Q19/${q19}` }],
			videos: [],
		},
	];

	const merged = mergeRuns(local, stored);
	expect(merged).toHaveLength(2);
	const q18Run = merged.find((run) => run.folder === 'misplaced')!;
	expect(q18Run.logs.map((log) => [log.name, log.stored, log.path])).toEqual([
		[q18, `misplaced/${q18}`, `/sync/2027/CAPH/Q18/${q18}`],
		[q18Hoot, undefined, `/sync/2027/CAPH/Q18/${q18Hoot}`],
	]);
	// The HOOT log isn't uploaded yet
	expect(isUploaded(q18Run)).toBe(false);
	expect(isUploaded(merged.find((run) => run.folder === '2027/CAPH/Q19')!)).toBe(false);
});

test('a video linked to a run whose logs are only on this computer is part of that run', () => {
	const stored = storageRuns(
		listing(
			[
				['2027/CAPH/Q19/phone.mov', 10],
				['2027/2027-03-13/Unsorted/other.mov', 10],
			],
			{
				'2027/CAPH/Q19/phone.mov.doglog.json': { version: 1, angle: 'Phone', offset: 2 },
			},
		),
	);
	const local = [
		{
			folder: '2027/CAPH/Q19',
			start: 1,
			match: 'CAPH Q19',
			kind: 'qualification' as const,
			event: 'CAPH',
			logs: [{ name: q19, size: 80, path: `/sync/2027/CAPH/Q19/${q19}` }],
			videos: [],
		},
	];
	const merged = mergeRuns(local, stored);
	expect(merged.map((run) => [run.folder, run.videos.map((video) => video.file)])).toEqual([
		['2027/2027-03-13/Unsorted/other.mov', ['2027/2027-03-13/Unsorted/other.mov']],
		['2027/CAPH/Q19', ['2027/CAPH/Q19/phone.mov']],
	]);
});

test('runs without a date come before the rest', () => {
	const runs = storageRuns(
		listing([
			[`2027/CAPH/Q18/${q18}`, 100],
			['Videos/phone.mov', 10],
			['2027/2027-03-14/Unsorted/pit.mov', 10],
		]),
	);
	expect(runs.map((run) => run.folder)).toEqual([
		'Videos/phone.mov',
		'2027/2027-03-14/Unsorted/pit.mov',
		'2027/CAPH/Q18',
	]);
});

test("a smaller copy in storage doesn't count as uploaded", () => {
	const stored = storageRuns(listing([[`2027/CAPH/Q18/${q18}`, 60]]));
	const local = [
		{
			folder: '2027/CAPH/Q18',
			start: 0,
			match: 'CAPH Q18',
			kind: 'qualification' as const,
			event: 'CAPH',
			logs: [{ name: q18, size: 100, path: `/sync/${q18}` }],
			videos: [],
		},
	];
	const [run] = mergeRuns(local, stored);
	expect(run!.logs[0]).toMatchObject({ size: 100, stored: undefined });
	expect(isUploaded(run!)).toBe(false);
});
