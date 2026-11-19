import { expect, test } from 'vite-plus/test';
import { knownGroup } from './known-groups.ts';

test('recognizes the groups devices and libraries log', () => {
	expect(knownGroup('/DS:joystick2')?.name).toBe('Controller 2');
	expect(knownGroup('/NT:/AdvantageKit/DriverStation/Joystick0')?.name).toBe('Controller 0');
	expect(knownGroup('/NT:/limelight-front')?.name).toBe('Limelight');
	expect(knownGroup('/limelight')?.name).toBe('Limelight');
	expect(knownGroup('/NT:/photonvision')?.name).toBe('PhotonVision');
	expect(knownGroup('/NT:/Tunables')?.name).toBe('Tunable values');
	expect(knownGroup('/Robot/Tunable')?.name).toBe('Tunable values');
	expect(knownGroup('/NT:/Spot')?.name).toBe('Spot');
	expect(knownGroup('/Robot/Trailblazer')?.name).toBe('Trailblazer');
});

test('ignores groups that only look like them', () => {
	expect(knownGroup('/DS:joystick2/extra')).toBeUndefined();
	expect(knownGroup('/DS:joystick7')).toBeUndefined();
	expect(knownGroup('/Robot/limelightHelpers')).toBeUndefined();
	expect(knownGroup('/NT:/Telemetry/Tunable')).toBeUndefined();
	expect(knownGroup('/Robot/Shooter/Spot')).toBeUndefined();
	expect(knownGroup('/Robot/Arm')).toBeUndefined();
});
