import { expect, test } from 'vite-plus/test';
import { getRobotHost } from './robot-target.ts';

test('team numbers use the standard robot address', () => {
	expect(getRobotHost('581')).toBe('10.5.81.2');
	expect(getRobotHost('1')).toBe('10.0.1.2');
	expect(getRobotHost('254')).toBe('10.2.54.2');
	expect(getRobotHost('12345')).toBe('10.123.45.2');
	expect(getRobotHost(' 581 ')).toBe('10.5.81.2');
});

test('IP addresses are used as is', () => {
	expect(getRobotHost('10.5.81.2')).toBe('10.5.81.2');
	expect(getRobotHost('172.22.11.2')).toBe('172.22.11.2');
});

test('invalid targets have no host', () => {
	expect(getRobotHost('')).toBeUndefined();
	expect(getRobotHost('0')).toBeUndefined();
	expect(getRobotHost('123456')).toBeUndefined();
	expect(getRobotHost('10.5.81.256')).toBeUndefined();
	expect(getRobotHost('10.5.81')).toBeUndefined();
	expect(getRobotHost('roborio-581-frc.local')).toBeUndefined();
});
