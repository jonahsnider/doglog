// Reads field-relative poses from entries, shared by the field widget's drawing code
import type { Entry } from '@/data/data-store';
import { numberField, structField } from '@/data/struct-fields';

/** How an entry is drawn: a robot footprint, small pose markers, or a line through its points */
export type FieldRole = 'robot' | 'markers' | 'path';

const structRoles: Partial<Record<string, FieldRole>> = {
	'struct:Pose2d': 'robot',
	'struct:Pose3d': 'robot',
	'struct:Pose2d[]': 'markers',
	'struct:Pose3d[]': 'markers',
	'struct:Translation2d[]': 'path',
};

/** What a bound entry is drawn as, `undefined` if the field widget doesn't accept it */
export function fieldRole(entry: Entry): FieldRole | undefined {
	const role = structRoles[entry.type];
	// Pose arrays named like PathPlanner's `activePath` or Choreo's `Trajectory` are paths, not separate objects
	if (role === 'markers' && /path|trajectory/iu.test(entry.name.slice(entry.name.lastIndexOf('/') + 1))) {
		return 'path';
	}
	return role;
}

/** Field-relative position in meters, with `heading` in radians counterclockwise from +X */
export type Pose = { x: number; y: number; heading: number };

/** Reads a Pose2d, Pose3d (its yaw), or Translation2d (no heading) */
export function readPose(value: unknown): Pose {
	const translation = structField(value, 'translation') ?? value;
	const rotation = structField(value, 'rotation');
	const quaternion = structField(rotation, 'q');
	return {
		x: numberField(translation, 'x'),
		y: numberField(translation, 'y'),
		heading: quaternion === undefined ? numberField(rotation, 'value') : yaw(quaternion),
	};
}

function yaw(quaternion: unknown): number {
	const w = numberField(quaternion, 'w');
	const x = numberField(quaternion, 'x');
	const y = numberField(quaternion, 'y');
	const z = numberField(quaternion, 'z');
	return Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
}
