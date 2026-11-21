import { expect, test } from 'vite-plus/test';
import { orientedField, wpilibCoordinates, xAxisAngle } from '@/widgets/field/geometry';

test('portrait orientations place the alliances at opposite ends without changing field coordinates', () => {
	const blueTop = orientedField('blue-top');
	const redTop = orientedField('red-top');
	expect(blueTop.bounds.width).toBeCloseTo(orientedField('blue-left').bounds.height);
	expect(blueTop.bounds.height).toBeCloseTo(orientedField('blue-left').bounds.width);

	// (2, 3) is 2 m from the blue wall and 3 m from the scoring-table side.
	for (const [field, svg] of [
		[blueTop, { x: 3, y: -14.541 }],
		[redTop, { x: 5.069, y: -2 }],
	] as const) {
		const drawn = field.toSvg({ x: 2, y: 3 });
		expect(drawn.x).toBeCloseTo(svg.x, 5);
		expect(drawn.y).toBeCloseTo(svg.y, 5);
		const picked = field.fromSvg(svg);
		expect(picked.x).toBeCloseTo(2, 5);
		expect(picked.y).toBeCloseTo(3, 5);
	}
});

test.each([
	['blue-left', 'blue-wall', 0],
	['red-left', 'blue-wall', Math.PI],
	// Blue at the top puts the blue wall's +X pointing down
	['blue-top', 'blue-wall', -Math.PI / 2],
	['red-top', 'blue-wall', Math.PI / 2],
	// Center coordinates' +X points toward blue, which is on the right with red on the left
	['red-left', 'center', 0],
	['blue-top', 'center', Math.PI / 2],
] as const)(
	'%s orientation with %s coordinates draws +X at %f radians on screen',
	(orientation, coordinates, angle) => {
		const actual = xAxisAngle(orientedField(orientation), coordinates);
		expect(Math.cos(actual)).toBeCloseTo(Math.cos(angle), 5);
		expect(Math.sin(actual)).toBeCloseTo(Math.sin(angle), 5);
	},
);

test('WPILib uses center coordinates from 2027 beta onward', () => {
	expect(wpilibCoordinates(undefined)).toBe('blue-wall');
	expect(wpilibCoordinates('2026.2.1')).toBe('blue-wall');
	// The alphas were released before the change
	expect(wpilibCoordinates('2027.0.0-alpha-8')).toBe('blue-wall');
	expect(wpilibCoordinates('2027.0.0-beta-1')).toBe('center');
	expect(wpilibCoordinates('2027.1.2')).toBe('center');
	expect(wpilibCoordinates('2028.0.0-alpha-1')).toBe('center');
});
