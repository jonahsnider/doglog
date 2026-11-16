import { expect, test } from 'vite-plus/test';
import type { Entry } from '@/data/data-store';
import { getEntryKind, Samples } from '@/data/samples';
import { inferAngleUnit } from '@/data/units';

function entry(name: string, type: string, metadata: Record<string, unknown> = {}): Entry {
	return { name, type, kind: getEntryKind(type), samples: new Samples(), metadata };
}

test.each([
	['/Drive/Gyro/Yaw', 'struct:Rotation2d', { unit: 'deg' }, 'radians'],
	['/Drive/Gyro/Yaw', 'double', { unit: 'Degree' }, 'degrees'],
	['/Drive/Gyro/Yaw', 'double', { unit: '°' }, 'degrees'],
	['/Drive/Gyro/Yaw', 'double', { unit: 'R' }, 'rotations'],
	['/Drive/Gyro/YawDeg', 'double', { unit: 'rad' }, 'radians'],
	['/Arm/PivotDeg', 'double', { unit: 'amps' }, 'degrees'],
	['/Turret/AngleRotations', 'double', {}, 'rotations'],
	['/Drive/Gyro/yaw_degrees', 'double', {}, 'degrees'],
	['/Drive/Gyro/Yaw', 'double', { properties: { unit: 'Degree' }, source: 'NT' }, 'degrees'],
	['/Drive/Gyro/Yaw', 'double', {}, 'radians'],
	['/Intake/Roller/Speed', 'double', {}, 'radians'],
	['/Drive/FR/Angle', 'double', {}, 'radians'],
	['/Drive/R', 'double', {}, 'radians'],
])('%s (%s, %o) is in %s', (name, type, metadata, unit) => {
	expect(inferAngleUnit(entry(name, type, metadata))).toBe(unit);
});
