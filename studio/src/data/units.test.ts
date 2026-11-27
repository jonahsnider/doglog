import { expect, test } from 'vite-plus/test';
import type { Entry } from '@/data/data-store';
import { createSamples, getEntryKind } from '@/data/samples';
import { convertUnit, inferAngleUnit, inferUnit, parseUnit } from '@/data/units';

function entry(name: string, type: string, metadata: Record<string, unknown> = {}): Entry {
	return { name, type, kind: getEntryKind(type), samples: createSamples(getEntryKind(type)), metadata };
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

test.each([
	['/Drive/VelocityMetersPerSec', {}, 'm/s'],
	['/Drive/LeftVelocityRPM', {}, 'rpm'],
	['/Elevator/AccelMetersPerSecSquared', {}, 'm/s²'],
	['/Drive/CurrentAmps', {}, 'A'],
	['/Drive/AppliedVolts', {}, 'V'],
	['/Drive/TempCelsius', {}, '°C'],
	['/Arm/PositionRotations', {}, 'rot'],
	['/Intake/In', {}, undefined],
	['/Arm/MinPosition', {}, undefined],
	['/Drive/Speed', { unit: 'ft/s' }, 'ft/s'],
	['/Drive/Accel', { unit: 'm/s^2' }, 'm/s²'],
	['/Drive/Speed', { unit: 'furlongs' }, undefined],
])('%s (%o) is in %s', (name, metadata, label) => {
	expect(inferUnit(entry(name, 'double', metadata))?.label).toBe(label);
});

test('units of the same measure convert between each other', () => {
	expect(convertUnit(1, parseUnit('ft')!, parseUnit('in')!)).toBeCloseTo(12);
	expect(convertUnit(60, parseUnit('rpm')!, parseUnit('rot/s')!)).toBeCloseTo(1);
	expect(convertUnit(212, parseUnit('°F')!, parseUnit('°C')!)).toBeCloseTo(100);
});
