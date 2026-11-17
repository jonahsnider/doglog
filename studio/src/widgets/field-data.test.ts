import { expect, test } from 'vite-plus/test';
import type { Entry } from '@/data/data-store';
import { getEntryKind, Samples } from '@/data/samples';
import { fieldRole, readPose } from '@/widgets/field-data';

function entry(name: string, type: string): Entry {
	return { name, type, kind: getEntryKind(type), samples: new Samples(), metadata: {} };
}

test.each([
	['/Drive/Pose', 'struct:Pose2d', 'robot'],
	['/Vision/TagPoses', 'struct:Pose3d[]', 'markers'],
	['/PathPlanner/activePath', 'struct:Pose2d[]', 'path'],
	['/Auto/Trajectory', 'struct:Pose3d[]', 'path'],
	// Only the last part of the name counts
	['/Trajectory/Targets', 'struct:Pose2d[]', 'markers'],
	['/Auto/Waypoints', 'struct:Translation2d[]', 'path'],
	['/Drive/Speeds', 'struct:ChassisSpeeds', undefined],
])('%s (%s) is drawn as %s', (name, type, role) => {
	expect(fieldRole(entry(name, type))).toBe(role);
});

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
