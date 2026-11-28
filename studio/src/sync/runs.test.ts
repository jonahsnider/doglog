import { expect, test } from 'vite-plus/test';
import { groupRuns, runFolders } from './runs.ts';

const log = (name: string) => ({ name, size: 1, path: `/sync/${name}` });

test('groups a match by its event and match, whatever the clock says', () => {
	const folders = runFolders([
		'WPILIB_20270313_231204_CAPH_Q18.wpilog',
		'WPILIB_20270313_231204_CAPH_Q18.2.wpilog',
		'CAPH_Q18_rio_2027-03-13_23-12-09.hoot',
	]);
	expect(new Set(folders.values())).toEqual(new Set(['2027/CAPH/Q18']));
});

test('puts a HOOT log from outside a match with the robot log that started closest to it', () => {
	const folders = runFolders([
		'FRC_20270312_180000.wpilog',
		'FRC_20270312_180130.wpilog',
		// 6 seconds after the second robot log, 96 seconds after the first
		'rio_2027-03-12_18-01-36.hoot',
		// Too far from any robot log to belong to one
		'rio_2027-03-12_19-00-00.hoot',
	]);
	expect(folders.get('rio_2027-03-12_18-01-36.hoot')).toBe(folders.get('FRC_20270312_180130.wpilog'));
	expect(folders.get('rio_2027-03-12_18-01-36.hoot')).not.toBe(folders.get('FRC_20270312_180000.wpilog'));
	expect(new Set(folders.values()).size).toBe(3);
});

test('leaves out files that are not logs', () => {
	expect(runFolders(['notes.wpilog', 'FRC_TBD_3f2a9c0d1e4b5a6c.wpilog'])).toEqual(new Map());
});

test('lists runs newest first with robot logs before HOOT logs', () => {
	const runs = groupRuns([
		log('CAPH_Q17_rio_2027-03-13_22-50-05.hoot'),
		log('WPILIB_20270313_225000_CAPH_Q17.wpilog'),
		log('WPILIB_20270313_231204_CAPH_Q18.wpilog'),
	]);
	expect(runs.map((run) => [run.match, run.event, run.kind])).toEqual([
		['CAPH Q18', 'CAPH', 'qualification'],
		['CAPH Q17', 'CAPH', 'qualification'],
	]);
	expect(runs[1]!.logs.map(({ name }) => name)).toEqual([
		'WPILIB_20270313_225000_CAPH_Q17.wpilog',
		'CAPH_Q17_rio_2027-03-13_22-50-05.hoot',
	]);
});
