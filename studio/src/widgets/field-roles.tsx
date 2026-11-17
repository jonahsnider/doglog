// The ways the field widget can draw an entry, and which entries can be drawn each way
import type { ReactNode } from 'react';
import type { Entry } from '@/data/data-store';
import type { Value } from '@/data/samples';
import { readPose } from '@/widgets/field-data';
import { Markers, Path, Robot, Shapes } from '@/widgets/field-shapes';
import type { RoleOption } from '@/widgets/widget-type';

type Draw = (value: Value, color: string) => ReactNode;

/** A single value is drawn like a one-item array */
const items = (value: Value): readonly unknown[] => (Array.isArray(value) ? value : [value]);
const poses = (value: Value) => items(value).map((item) => readPose(item));
const points: Draw = (value, color) => <Markers poses={poses(value)} color={color} />;

/** Every role in draw order, later ones are drawn on top */
const roles = [
	{ id: 'shape', label: 'Shape', draw: (value, color) => <Shapes values={items(value)} color={color} /> },
	{ id: 'path', label: 'Path', draw: (value, color) => <Path poses={poses(value)} color={color} /> },
	{ id: 'points', label: 'Points', draw: points },
	{ id: 'point', label: 'Point', draw: points },
	{ id: 'ghost', label: 'Ghost', draw: (value, color) => <Robot pose={readPose(value)} color={color} ghost /> },
	{ id: 'robot', label: 'Robot', draw: (value, color) => <Robot pose={readPose(value)} color={color} /> },
] as const satisfies readonly (RoleOption & { draw: Draw })[];

type FieldRoleId = (typeof roles)[number]['id'];

const pose: readonly FieldRoleId[] = ['robot', 'ghost', 'point'];
const poseArray: readonly FieldRoleId[] = ['points', 'path'];
const translationArray: readonly FieldRoleId[] = ['path', 'points'];
const shape: readonly FieldRoleId[] = ['shape'];

/** Roles each type can take, the inferred one first */
const typeRoles: Partial<Record<string, readonly FieldRoleId[]>> = {
	'struct:Pose2d': pose,
	'struct:Pose3d': pose,
	'struct:Pose2d[]': poseArray,
	'struct:Pose3d[]': poseArray,
	'struct:Translation2d': ['point'],
	'struct:Translation3d': ['point'],
	'struct:Translation2d[]': translationArray,
	'struct:Translation3d[]': translationArray,
	'struct:Rectangle2d': shape,
	'struct:Rectangle2d[]': shape,
	'struct:Ellipse2d': shape,
	'struct:Ellipse2d[]': shape,
};

/** Roles an entry can take on the field, the inferred one first. None if the field doesn't accept it. */
export function fieldRoles(entry: Entry): RoleOption[] {
	let ids = typeRoles[entry.type] ?? [];
	// Arrays named like PathPlanner's `activePath` or Choreo's `Trajectory` are paths, not separate points
	if (ids.includes('path') && /path|trajectory/iu.test(entry.name.slice(entry.name.lastIndexOf('/') + 1))) {
		ids = ['path', ...ids.filter((id) => id !== 'path')];
	}
	return ids.flatMap((id) => roles.filter((role) => role.id === id).map(({ label }) => ({ id, label })));
}

/** How a role is drawn, and its `layer`: higher layers are drawn on top. `undefined` for roles the field doesn't have. */
export function fieldDrawing(roleId: string): { layer: number; draw: Draw } | undefined {
	const layer = roles.findIndex((role) => role.id === roleId);
	return layer === -1 ? undefined : { layer, draw: roles[layer]!.draw };
}

export const layerCount = roles.length;
