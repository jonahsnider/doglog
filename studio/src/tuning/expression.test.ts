import { expect, test } from 'vite-plus/test';
import { parseUnit } from '@/data/units';
import { evaluateExpression, roundNumber } from '@/tuning/expression';

test.each([
	['12', 12],
	[' 0.25 ', 0.25],
	['.5', 0.5],
	['1e3', 1000],
	['10 + 1', 11],
	['10 - 4 - 3', 3],
	['2 + 3 * 4', 14],
	['(2 + 3) * 4', 20],
	['12 / 4 / 3', 1],
	['-3 * -2', 6],
	['-(2 + 4) / 4', -1.5],
	['2 * -(1 - 4)', 6],
	['0.1 + 0.2', 0.3],
	['2 / 3', 2 / 3],
	['1 / 3 * 3', 1],
	['1.5e-3 * 2', 0.003],
	['1.e3', 1000],
	// Values from the robot that aren't arithmetic keep every digit
	['0.6666666666666666', 2 / 3],
	['-0.6666666666666666', -2 / 3],
])('%s is %d', (text, value) => {
	expect(evaluateExpression(text)).toBe(value);
});

test.each(['', 'abc', '1 2', '2 +', '(1 + 2', '1 + 2)', '1 / 0', '1e', '2 ** 3', 'Infinity'])(
	'%j is invalid',
	(text) => {
		expect(evaluateExpression(text)).toBeUndefined();
	},
);

test.each([
	[2 / 3, '0.67'],
	[-1.305555556, '-1.31'],
	[13.6, '13.6'],
	[2500, '2500'],
	// Small gains keep 2 significant digits instead of rounding to 0
	[0.000_123, '0.00012'],
	[0.0005, '0.0005'],
])('%d is rounded to %s', (value, text) => {
	expect(roundNumber(value)).toBe(text);
});

test.each([
	['5 ft', 'm', 1.524],
	['1ft + 6 in', 'm', 0.4572],
	['6 ft / 2', 'm', 0.9144],
	['6 ft/s', 'm/s', 1.8288],
	['-90 deg', 'rad', -Math.PI / 2],
	['3000 rpm', 'rot/s', 50],
	['2 m', 'm', 2],
	['32 °F', '°C', 0],
])('%s is %d %s', (text, unit, value) => {
	expect(evaluateExpression(text, parseUnit(unit))).toBeCloseTo(value, 12);
});

test.each([
	['5 ft', 'V'],
	// A tunable without a known unit
	['5 ft', 'unknown'],
	['5 furlongs', 'm'],
	['6 ft/s', 'm'],
])('%s is invalid in %s', (text, unit) => {
	expect(evaluateExpression(text, parseUnit(unit))).toBeUndefined();
});
