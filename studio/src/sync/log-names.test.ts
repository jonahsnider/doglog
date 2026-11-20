import { expect, test } from 'vite-plus/test';
import type { Entry } from '@/data/data-store';
import { getEntryKind, Samples, type Value } from '@/data/samples';
import { parseLogName, readLogMatch } from './log-names.ts';

test('WPILib logs', () => {
	expect(parseLogName('FRC_20260315_143000.wpilog')).toEqual({
		date: new Date('2026-03-15T14:30:00Z'),
		match: undefined,
	});
	expect(parseLogName('FRC_20260315_143000_CAPH_Q12.wpilog')).toEqual({
		date: new Date('2026-03-15T14:30:00Z'),
		match: { label: 'CAPH Q12', type: 'qualification' },
	});
	expect(parseLogName('FRC_20260315_143000_CAPH_P3.wpilog')?.match).toEqual({
		label: 'CAPH P3',
		type: 'practice',
	});
	expect(parseLogName('FRC_20260315_143000_2026CMPTX_E14.wpilog')?.match).toEqual({
		label: '2026CMPTX E14',
		type: 'elimination',
	});
	expect(parseLogName('FRC_20241110_165657__Q68.wpilog')?.match?.label).toBe('Q68');
	// Ex. a practice match on a practice field
	expect(parseLogName('FRC_20260422_015845__P0.wpilog')?.match).toEqual({
		label: 'P0',
		type: 'practice',
	});
});

test('WPILIB prefix', () => {
	expect(parseLogName('WPILIB_20261118_003735.wpilog')).toEqual({
		date: new Date('2026-11-18T00:37:35Z'),
		match: undefined,
	});
	expect(parseLogName('WPILIB_20261118_003735_CAPH_E4.wpilog')).toEqual({
		date: new Date('2026-11-18T00:37:35Z'),
		match: { label: 'CAPH E4', type: 'elimination' },
	});
});

test('AdvantageKit logs', () => {
	expect(parseLogName('akit_26-03-15_14-30-00.wpilog')).toEqual({
		date: new Date('2026-03-15T14:30:00Z'),
		match: undefined,
	});
	expect(parseLogName('akit_26-03-15_14-30-00_caph_q12.wpilog')?.match).toEqual({
		label: 'CAPH Q12',
		type: 'qualification',
	});
	// The event name is left out when the field doesn't send one
	expect(parseLogName('akit_26-03-15_14-30-00_e4.wpilog')?.match).toEqual({
		label: 'E4',
		type: 'elimination',
	});
	// Connected to the field without a match, ex. at a field test
	expect(parseLogName('akit_26-03-15_14-30-00_caph.wpilog')).toEqual({
		date: new Date('2026-03-15T14:30:00Z'),
		event: 'CAPH',
		match: undefined,
	});
});

test('logs that will be renamed once they have a date', () => {
	expect(parseLogName('FRC_TBD_3f2a9c0d1e4b5a6c.wpilog')).toBeUndefined();
	expect(parseLogName('WPILIB_TBD_4b89630e99127056.wpilog')).toBeUndefined();
	expect(parseLogName('akit_3f2a9c0d.wpilog')).toBeUndefined();
});

test('other files', () => {
	expect(parseLogName('FRC_20260315_143000.hoot')).toBeUndefined();
	expect(parseLogName('match.wpilog')).toBeUndefined();
	expect(parseLogName('FRC_20260230_143000.wpilog')).toBeUndefined();
	expect(parseLogName('WPILIB_20261118_126035.wpilog')).toBeUndefined();
	expect(parseLogName('FRC_20260315_143000_pit-notes.wpilog')).toBeUndefined();
});

/** Look up entries with one latest value each, ex. `{ '/NT:/FMSInfo/MatchNumber': ['int64', 12] }` */
function entries(values: Record<string, [type: string, value: Value]>) {
	return (name: string): Entry | undefined => {
		const [type, value] = values[name] ?? [];
		if (type === undefined || value === undefined) {
			return undefined;
		}
		return {
			name,
			type,
			kind: getEntryKind(type),
			samples: new Samples(new Float64Array([0]), [value]),
			metadata: {},
		};
	};
}

test('Match from Driver Station data', () => {
	expect(
		readLogMatch(
			entries({
				'/NT:/FMSInfo/EventName': ['string', 'caph'],
				'/NT:/FMSInfo/MatchType': ['int64', 2],
				'/NT:/FMSInfo/MatchNumber': ['int64', 12],
			}),
		),
	).toEqual({ label: 'CAPH Q12', type: 'qualification' });
	// AdvantageKit, without an event name
	expect(
		readLogMatch(
			entries({
				'/DriverStation/EventName': ['string', ''],
				'/DriverStation/MatchType': ['int64', 3],
				'/DriverStation/MatchNumber': ['int64', 4],
			}),
		),
	).toEqual({ label: 'E4', type: 'elimination' });
	// Outside of a match
	expect(
		readLogMatch(entries({ '/NT:/FMSInfo/MatchType': ['int64', 0], '/NT:/FMSInfo/MatchNumber': ['int64', 0] })),
	).toBeUndefined();
	expect(readLogMatch(entries({}))).toBeUndefined();
});
