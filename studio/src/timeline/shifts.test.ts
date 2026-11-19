import { expect, test } from 'vite-plus/test';
import type { ModePeriod } from './events.ts';
import { getActiveShifts } from './shifts.ts';

const s = 1_000_000;

/** A match's modes, with auto starting at 309.32 s and the field's 3 s wait before teleop */
function match(autoLength: number, teleopLength: number): ModePeriod[] {
	const autoEnd = 309.32 * s + autoLength;
	const teleopStart = autoEnd + 2.98 * s;
	return [
		{ mode: 'disabled', start: 0, end: 309.32 * s },
		{ mode: 'auto', start: 309.32 * s, end: autoEnd },
		{ mode: 'disabled', start: autoEnd, end: teleopStart },
		{ mode: 'teleop', start: teleopStart, end: teleopStart + teleopLength },
		{ mode: 'disabled', start: teleopStart + teleopLength, end: teleopStart + teleopLength + 10 * s },
	];
}

const teleopStart = 332.33 * s;
const shiftTimes = (shifts: ReturnType<typeof getActiveShifts>) =>
	shifts.map(({ name, start, end }) => [name, (start - teleopStart) / s, (end - teleopStart) / s]);

test('alliances that score more in auto are active in shifts 2 and 4', () => {
	const shifts = getActiveShifts(match(20.03 * s, 139.97 * s), 2026, () => false);
	expect(shiftTimes(shifts)).toEqual([
		['Transition shift', 0, 10],
		['Shift 2', 35, 60],
		['Shift 4', 85, 110],
		['End game', 110, 139.97],
	]);
});

test('alliances that score less in auto are active in shifts 1 and 3', () => {
	const shifts = getActiveShifts(match(20 * s, 140 * s), 2026, () => true);
	expect(shifts.map((shift) => shift.name)).toEqual(['Transition shift', 'Shift 1', 'Shift 3', 'End game']);
});

test('shifts end with teleop', () => {
	const shifts = getActiveShifts(match(20.03 * s, 50 * s), 2026, () => false);
	expect(shiftTimes(shifts)).toEqual([
		['Transition shift', 0, 10],
		['Shift 2', 35, 50],
	]);
});

test.each([
	{ name: 'without game data', periods: match(20 * s, 140 * s), year: 2026, activeFirst: undefined },
	{ name: '2025 match timing', periods: match(15 * s, 135 * s), year: 2026, activeFirst: true },
	{ name: 'a match from another year', periods: match(20 * s, 140 * s), year: 2027, activeFirst: true },
	{ name: 'teleop longer than a match', periods: match(20 * s, 170 * s), year: 2026, activeFirst: true },
	{ name: 'auto stopped early', periods: match(18 * s, 140 * s), year: 2026, activeFirst: true },
])('no shifts $name', ({ periods, year, activeFirst }) => {
	expect(getActiveShifts(periods, year, () => activeFirst)).toEqual([]);
});
