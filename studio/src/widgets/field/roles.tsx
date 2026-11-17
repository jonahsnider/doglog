// The ways the field widget can draw an entry, and which entries can be drawn each way
import type { ReactNode } from 'react';
import type { Entry } from '@/data/data-store';
import type { Value } from '@/data/samples';
import { readPose } from '@/widgets/field/data';
import { bindingColor } from '@/widgets/series-color';
import { Connections, Markers, Path, Robot, Shapes } from '@/widgets/field/shapes';
import type { Connects, RoleOption, WidgetBinding } from '@/widgets/widget-type';

type Draw = (value: Value, color: string) => ReactNode;

/** A single value is drawn like a one-item array */
const items = (value: Value): readonly unknown[] => (Array.isArray(value) ? value : [value]);
const poses = (value: Value) => items(value).map((item) => readPose(item));
const points: Draw = (value, color) => <Markers poses={poses(value)} color={color} />;

const roles = [
	{ id: 'shape', label: 'Shape', draw: (value, color) => <Shapes values={items(value)} color={color} /> },
	{ id: 'path', label: 'Path', draw: (value, color) => <Path poses={poses(value)} color={color} /> },
	{ id: 'points', label: 'Points', draw: points },
	{ id: 'point', label: 'Point', draw: points },
	{ id: 'ghost', label: 'Ghost', draw: (value, color) => <Robot pose={readPose(value)} color={color} ghost /> },
	{ id: 'robot', label: 'Robot', draw: (value, color) => <Robot pose={readPose(value)} color={color} /> },
] as const satisfies readonly (RoleOption & { draw: Draw })[];

type FieldRoleId = (typeof roles)[number]['id'];

/** Every layer, later ones are drawn on top. Connections are drawn from the bindings connected to another, not by a role. */
const drawOrder = ['shape', 'path', 'connections', 'points', 'point', 'ghost', 'robot'] as const satisfies readonly (
	| FieldRoleId
	| 'connections'
)[];

const pose: readonly FieldRoleId[] = ['robot', 'ghost', 'point'];
const translation: readonly FieldRoleId[] = ['point'];
const poseArray: readonly FieldRoleId[] = ['points', 'path'];
const translationArray: readonly FieldRoleId[] = ['path', 'points'];
const shape: readonly FieldRoleId[] = ['shape'];

/** Roles each type can take, the inferred one first */
const typeRoles: Partial<Record<string, readonly FieldRoleId[]>> = {
	'struct:Pose2d': pose,
	'struct:Pose3d': pose,
	'struct:Pose2d[]': poseArray,
	'struct:Pose3d[]': poseArray,
	'struct:Translation2d': translation,
	'struct:Translation3d': translation,
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

/** The first pose is drawn as a robot, and later ones as ghosts, ex. a setpoint added after the robot's pose */
export function inferFieldRole(
	options: readonly RoleOption[],
	earlier: readonly WidgetBinding[],
): RoleOption | undefined {
	if (!options.some((option) => option.id === 'robot')) {
		return undefined;
	}
	const anotherPose = earlier.some((binding) => binding.roles.some((option) => option.id === 'robot'));
	return options.find((option) => option.id === (anotherPose ? 'ghost' : 'robot'));
}

const singleRoles: ReadonlySet<string> = new Set(['robot', 'ghost', 'point']);
const manyRoles: ReadonlySet<string> = new Set(['points', 'path']);

/** Single poses and translations can be connected to anything but shapes, which can't be connected */
export function fieldConnects(binding: WidgetBinding): Connects | undefined {
	const role = binding.role?.id;
	if (role !== undefined && singleRoles.has(role)) {
		return 'single';
	}
	return role !== undefined && manyRoles.has(role) ? 'many' : undefined;
}

/**
 * Every binding's drawing at the cursor in draw order, with lines from the bindings connected to it. Earlier bindings
 * are drawn on top of later ones with the same role.
 */
export function fieldDrawings(
	bindings: readonly WidgetBinding[],
	valueOf: (binding: WidgetBinding) => Value | undefined,
): ReactNode[] {
	const layers: ReactNode[][] = drawOrder.map(() => []);
	bindings.forEach((binding, index) => {
		const role = roles.find((option) => option.id === binding.role?.id);
		const value = valueOf(binding);
		if (role === undefined || value === undefined || binding.hidden) {
			return;
		}
		const color = bindingColor(binding, index);
		layers[drawOrder.indexOf(role.id)]!.push(
			// Right-clicking a drawing offers to remove its binding, middle-clicking removes it
			<g key={binding.id} data-binding-id={binding.id}>
				{role.draw(value, color)}
			</g>,
		);
		// Hidden sources hide the lines drawn from them
		for (const source of binding.sources) {
			const sourceValue = source.hidden ? undefined : valueOf(source);
			if (sourceValue !== undefined) {
				layers[drawOrder.indexOf('connections')]!.push(
					<Connections
						key={`${source.id}-${binding.id}`}
						from={readPose(sourceValue)}
						poses={poses(value)}
						color={color}
					/>,
				);
			}
		}
	});
	return layers.flatMap((layer) => layer.toReversed());
}
