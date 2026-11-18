// WPILib poses and transforms as three.js matrices. Both use the same right-handed axes, so nothing is swapped.
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { numberField, structField } from '@/data/struct-fields';

/** A transform as written in robot configs, meters and degrees, each 0 when left out */
export type Transform = {
	readonly x?: number | undefined;
	readonly y?: number | undefined;
	readonly z?: number | undefined;
	readonly roll?: number | undefined;
	readonly pitch?: number | undefined;
	readonly yaw?: number | undefined;
};

const unitScale = new Vector3(1, 1, 1);

function radians(degrees: number | undefined): number {
	return ((degrees ?? 0) * Math.PI) / 180;
}

/**
 * A transform's matrix. Rotations mean the same as WPILib's `Rotation3d(roll, pitch, yaw)`: about the fixed X, Y, then Z
 * axes, which is three.js's ZYX order.
 */
export function transformMatrix(transform: Transform = {}): Matrix4 {
	const rotation = new Quaternion().setFromEuler(
		new Euler(radians(transform.roll), radians(transform.pitch), radians(transform.yaw), 'ZYX'),
	);
	return new Matrix4().compose(new Vector3(transform.x ?? 0, transform.y ?? 0, transform.z ?? 0), rotation, unitScale);
}

/** A decoded WPILib `Pose3d` struct's matrix, `undefined` if the value isn't one */
export function poseMatrix(pose: unknown): Matrix4 | undefined {
	const translation = structField(pose, 'translation');
	const quaternion = structField(structField(pose, 'rotation'), 'q');
	if (translation === undefined || quaternion === undefined) {
		return undefined;
	}
	return new Matrix4().compose(
		new Vector3(numberField(translation, 'x'), numberField(translation, 'y'), numberField(translation, 'z')),
		new Quaternion(
			numberField(quaternion, 'x'),
			numberField(quaternion, 'y'),
			numberField(quaternion, 'z'),
			numberField(quaternion, 'w'),
		).normalize(),
		unitScale,
	);
}
