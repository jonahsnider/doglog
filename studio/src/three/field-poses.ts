// Poses on the field in 3D, in field meters (+X toward red, +Y left from the blue driver stations, +Z up, from WPILib
// 2026's origin at the blue alliance wall)
import { Matrix4, Vector3 } from 'three';
import { numberField, structField } from '@/data/struct-fields';
import type { Value } from '@/data/samples';
import { poseMatrix } from '@/three/poses';
import { type FieldCoordinates, fieldLength, fieldWidth } from '@/widgets/field/geometry';

/** Drawings on the floor are lifted this many meters, so they don't flicker into the carpet */
export const floorOffset = 0.01;
/** Height lines start at on robots, about their center */
const robotCenterHeight = 0.15;
export const identity = new Matrix4();

/** WPILib 2027's coordinates are turned a half turn around the field's center from 2026's */
export const centerCoordinates = new Matrix4()
	.makeTranslation(fieldLength / 2, fieldWidth / 2, 0)
	.multiply(new Matrix4().makeRotationZ(Math.PI));

export const items = (value: Value): readonly unknown[] => (Array.isArray(value) ? value : [value]);

/**
 * A pose's or translation's matrix in field meters: Pose3d as logged, Pose2d and translations turned by their heading,
 * if any, at the height of Translation3d
 */
export function fieldPoseMatrix(value: unknown): Matrix4 {
	const matrix = poseMatrix(value);
	if (matrix) {
		return matrix;
	}
	const translation = structField(value, 'translation') ?? value;
	const rotation = structField(value, 'rotation');
	return new Matrix4()
		.makeRotationZ(rotation === undefined ? 0 : numberField(rotation, 'value'))
		.setPosition(numberField(translation, 'x'), numberField(translation, 'y'), numberField(translation, 'z'));
}

export const isPose = (value: unknown) => structField(value, 'rotation') !== undefined;

/** Where a robot is on the field, in the field's model's coordinates, ex. for the camera to follow it */
export function robotPosition(value: Value, coordinates: FieldCoordinates): Vector3 {
	return anchor(value, 'robot').applyMatrix4(coordinates === 'center' ? centerCoordinates : identity);
}

/** Where a drawing's lines start and end: a point's center, or about the center of a robot */
export function anchor(value: unknown, role: string | undefined): Vector3 {
	const matrix = fieldPoseMatrix(value);
	const height = role === 'robot' || role === 'ghost' ? robotCenterHeight : 0;
	const position = new Vector3(0, 0, height).applyMatrix4(matrix);
	return lifted(position);
}

/** Lifts points on the floor a little, so lines along it don't flicker into the carpet */
export function lifted(position: Vector3): Vector3 {
	return position.z < floorOffset ? position.setZ(floorOffset) : position;
}
