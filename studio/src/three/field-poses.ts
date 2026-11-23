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

/** One of the six driver stations, numbered 1 to 3 from the drivers' left */
export type DriverStation = { readonly alliance: 'blue' | 'red'; readonly number: 1 | 2 | 3 };

export const driverStations: readonly DriverStation[] = (['blue', 'red'] as const).flatMap((alliance) =>
	([1, 2, 3] as const).map((number) => ({ alliance, number })),
);

export const driverStationLabel = ({ alliance, number }: DriverStation) =>
	`${alliance === 'blue' ? 'Blue' : 'Red'} ${number}`;

/** Tells driver stations apart, ex. `red-2` */
export const driverStationKey = ({ alliance, number }: DriverStation) => `${alliance}-${number}`;

/**
 * The centers of the blue driver stations' glass across the field, 1 to 3, from the field's CAD. They aren't evenly
 * spaced, the tower is between 2 and 3. Red's are turned a half turn around the field's center.
 */
const blueStationYs = [7.115, 5.285, 2.205] as const;
/** Where drivers' eyes are, this many meters behind the alliance wall and above the carpet */
const driverEyeDistance = 1;
const driverEyeHeight = 1.6;

/** Where a driver at `station` sees the field from, in the field's model's coordinates */
export function driverEye({ alliance, number }: DriverStation): Vector3 {
	const y = blueStationYs[number - 1]!;
	return alliance === 'blue'
		? new Vector3(-driverEyeDistance, y, driverEyeHeight)
		: new Vector3(fieldLength + driverEyeDistance, fieldWidth - y, driverEyeHeight);
}
