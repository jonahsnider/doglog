import { expect, test } from 'vite-plus/test';
import { parseLogName } from './log-names.ts';

test('WPILib logs', () => {
	expect(parseLogName('FRC_20260315_143000.wpilog')).toEqual({
		date: new Date('2026-03-15T14:30:00Z'),
		match: undefined,
	});
	expect(parseLogName('FRC_20260315_143000_CAPH_Q12.wpilog')).toEqual({
		date: new Date('2026-03-15T14:30:00Z'),
		match: { label: 'CAPH Q12', type: 'qualification' },
	});
	expect(parseLogName('FRC_20260315_143000_CAPH_P3.wpilog')?.match).toEqual({ label: 'CAPH P3', type: 'practice' });
	expect(parseLogName('FRC_20260315_143000_2026CMPTX_E14.wpilog')?.match).toEqual({
		label: '2026CMPTX E14',
		type: 'elimination',
	});
	// Without an event name
	expect(parseLogName('FRC_20241110_165657__Q68.wpilog')?.match?.label).toBe('Q68');
	// The Driver Station reports match 0 outside of matches, ex. at home
	expect(parseLogName('FRC_20260422_015845__P0.wpilog')?.match).toBeUndefined();
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
	expect(parseLogName('akit_26-03-15_14-30-00_e4.wpilog')?.match).toEqual({ label: 'E4', type: 'elimination' });
	// Connected to the field without a match, ex. at a field test
	expect(parseLogName('akit_26-03-15_14-30-00_caph.wpilog')?.match).toBeUndefined();
});

test('logs that will be renamed once they have a date', () => {
	expect(parseLogName('FRC_TBD_3f2a9c0d1e4b5a6c.wpilog')).toBeUndefined();
	expect(parseLogName('akit_3f2a9c0d.wpilog')).toBeUndefined();
});

test('other files', () => {
	expect(parseLogName('FRC_20260315_143000.hoot')).toBeUndefined();
	expect(parseLogName('match.wpilog')).toBeUndefined();
	expect(parseLogName('FRC_20260230_143000.wpilog')).toBeUndefined();
});
