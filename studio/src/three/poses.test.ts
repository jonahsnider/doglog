import { Vector3 } from 'three';
import { expect, test } from 'vite-plus/test';
import { poseMatrix, transformMatrix } from '@/three/poses';

function rounded(vector: Vector3): number[] {
	// Adding 0 turns -0 into 0
	return vector.toArray().map((axis) => Math.round(axis * 1000) / 1000 + 0);
}

test.each([
	// The front of the robot turns toward its left
	[{ yaw: 90 }, [0, 1, 0]],
	// Positive pitch points the front down, like WPILib
	[{ pitch: 90 }, [0, 0, -1]],
	[{ roll: 90 }, [1, 0, 0]],
	[{ x: 1, z: 2 }, [2, 0, 2]],
])('transform %o moves the front to %o', (transform, expected) => {
	expect(rounded(new Vector3(1, 0, 0).applyMatrix4(transformMatrix(transform)))).toEqual(expected);
});

test('applies roll, then pitch, then yaw about the fixed axes, like WPILib', () => {
	// Rolling first leaves +X alone, then pitching points it down, then yawing doesn't move it
	const matrix = transformMatrix({ roll: 90, pitch: 90, yaw: 90 });
	expect(rounded(new Vector3(1, 0, 0).applyMatrix4(matrix))).toEqual([0, 0, -1]);
	// +Y rolls to +Z, pitching sends +Z to +X, and yawing sends +X to +Y
	expect(rounded(new Vector3(0, 1, 0).applyMatrix4(matrix))).toEqual([0, 1, 0]);
});

test('reads Pose3d structs', () => {
	// A quarter turn of yaw: q = (cos 45°, 0, 0, sin 45°)
	const pose = { translation: { x: 1, y: 2, z: 3 }, rotation: { q: { w: Math.SQRT1_2, x: 0, y: 0, z: Math.SQRT1_2 } } };
	expect(rounded(new Vector3(1, 0, 0).applyMatrix4(poseMatrix(pose)!))).toEqual([1, 3, 3]);
	expect(poseMatrix({ x: 1 })).toBeUndefined();
});
