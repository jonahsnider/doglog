import { expect, test } from 'vite-plus/test';
import { ambiguousSegments, distinctSegments } from '@/entries/short-names';

test('names are shortened to the last segments that tell them apart', () => {
	const names = ['/Robot/Drive/Velocity', '/Robot/Arm/Velocity', '/Robot/Arm/Angle'];
	expect(distinctSegments('/Robot/Drive/Velocity', names)).toBe(2);
	expect(distinctSegments('/Robot/Arm/Angle', names)).toBe(1);
	// The same entry bound twice is still shortened
	expect(distinctSegments('/Robot/Arm/Angle', [...names, '/Robot/Arm/Angle'])).toBe(1);
});

test('segments that would shorten the same as another beside them are kept in full', () => {
	const names = ['/Robot/Swerve/Speed', '/Robot/Shooter/Angle', '/Robot/Arm/Angle', '/Other/Swerve/Speed'];
	// `/Robot/Swerve` starts at 6, and `/Robot` doesn't clash with `/Other`
	expect(ambiguousSegments('/Robot/Swerve/Speed', names)).toEqual(new Set([6]));
	expect(ambiguousSegments('/Robot/Arm/Angle', names)).toEqual(new Set());
});
