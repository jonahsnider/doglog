import { expect, test } from 'vite-plus/test';
import { wpilibCoordinates } from '@/widgets/field/geometry';

test('WPILib uses center coordinates from 2027 beta onward', () => {
	expect(wpilibCoordinates(undefined)).toBe('blue-wall');
	expect(wpilibCoordinates('2026.2.1')).toBe('blue-wall');
	// The alphas were released before the change
	expect(wpilibCoordinates('2027.0.0-alpha-8')).toBe('blue-wall');
	expect(wpilibCoordinates('2027.0.0-beta-1')).toBe('center');
	expect(wpilibCoordinates('2027.1.2')).toBe('center');
	expect(wpilibCoordinates('2028.0.0-alpha-1')).toBe('center');
});
