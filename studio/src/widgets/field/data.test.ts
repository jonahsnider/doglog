import { expect, test } from 'vite-plus/test';
import { readPose } from '@/widgets/field/data';

test('Pose3d heading is its yaw', () => {
	const yaw = Math.PI / 4;
	// Rolled 90° after yawing 45°, which mustn't change the heading
	const roll = Math.PI / 2;
	const q = {
		w: Math.cos(yaw / 2) * Math.cos(roll / 2),
		x: Math.cos(yaw / 2) * Math.sin(roll / 2),
		y: Math.sin(yaw / 2) * Math.sin(roll / 2),
		z: Math.sin(yaw / 2) * Math.cos(roll / 2),
	};
	const pose = readPose({ translation: { x: 1, y: 2, z: 0.5 }, rotation: { q } });
	expect(pose.x).toBe(1);
	expect(pose.y).toBe(2);
	expect(pose.heading).toBeCloseTo(yaw);
});
