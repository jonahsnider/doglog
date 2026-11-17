// Reads field-relative poses and shapes from entry values, shared by the field widget's drawing code
import { numberField, structField } from '@/data/struct-fields';

/** Field-relative position in meters, with `heading` in radians counterclockwise from +X, `undefined` for translations */
export type Pose = { x: number; y: number; heading: number | undefined };

/** Reads a Pose2d, Pose3d (its yaw), Translation2d, or Translation3d (ignoring Z) */
export function readPose(value: unknown): Pose {
	const translation = structField(value, 'translation') ?? value;
	const rotation = structField(value, 'rotation');
	const quaternion = structField(rotation, 'q');
	return {
		x: numberField(translation, 'x'),
		y: numberField(translation, 'y'),
		heading:
			rotation === undefined ? undefined : quaternion === undefined ? numberField(rotation, 'value') : yaw(quaternion),
	};
}

function yaw(quaternion: unknown): number {
	const w = numberField(quaternion, 'w');
	const x = numberField(quaternion, 'x');
	const y = numberField(quaternion, 'y');
	const z = numberField(quaternion, 'z');
	return Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
}

/** A Rectangle2d or Ellipse2d, with its half-widths along its own X and Y axes */
export type Shape = { kind: 'rectangle' | 'ellipse'; center: Pose; xRadius: number; yRadius: number };

export function readShape(value: unknown): Shape {
	const center = readPose(structField(value, 'center'));
	return structField(value, 'xWidth') === undefined
		? {
				kind: 'ellipse',
				center,
				xRadius: numberField(value, 'xSemiAxis'),
				yRadius: numberField(value, 'ySemiAxis'),
			}
		: {
				kind: 'rectangle',
				center,
				xRadius: numberField(value, 'xWidth') / 2,
				yRadius: numberField(value, 'yWidth') / 2,
			};
}
