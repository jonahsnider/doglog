import type { ReactNode } from 'react';
import type { Entry } from '@/data/data-store';
import type { Value } from '@/data/samples';
import { readPose } from '@/widgets/field/data';
import { bindingColor } from '@/widgets/series-color';
import { Connections, Markers, Path, Robot, Shapes } from '@/widgets/field/shapes';
import { widgetRoles } from '@/widgets/widget-info';
import type { Connects, RoleOption, WidgetBinding } from '@/widgets/widget-type';

type Draw = (value: Value, color: string) => ReactNode;

const items = (value: Value): readonly unknown[] => (Array.isArray(value) ? value : [value]);
const poses = (value: Value) => items(value).map((item) => readPose(item));
const points: Draw = (value, color) => <Markers poses={poses(value)} color={color} />;

const field = widgetRoles.field;
const roles = [
	{ ...field.shape, draw: (value, color) => <Shapes values={items(value)} color={color} /> },
	{ ...field.path, draw: (value, color) => <Path poses={poses(value)} color={color} /> },
	{ ...field.points, draw: points },
	{ ...field.point, draw: points },
	{ ...field.ghost, draw: (value, color) => <Robot pose={readPose(value)} color={color} ghost /> },
	{ ...field.robot, draw: (value, color) => <Robot pose={readPose(value)} color={color} /> },
] as const satisfies readonly (RoleOption & { draw: Draw })[];

type FieldRoleId = keyof typeof field;

/** Roles only drawn in 3D, on a robot */
export const attachedRoles: ReadonlySet<string> = new Set(['parts', 'side', 'front', 'top'] satisfies FieldRoleId[]);
export const roles3d: ReadonlySet<string> = new Set([...attachedRoles, 'camera']);

/** Every layer, later ones are drawn on top. Connections are drawn from the bindings connected to another, not by a role. */
const drawOrder = ['shape', 'path', 'connections', 'points', 'point', 'ghost', 'robot'] as const satisfies readonly (
	| FieldRoleId
	| 'connections'
)[];

const pose: readonly FieldRoleId[] = ['robot', 'ghost', 'point'];
const pose3d: readonly FieldRoleId[] = [...pose, 'camera'];
const translation: readonly FieldRoleId[] = ['point'];
const poseArray: readonly FieldRoleId[] = ['points', 'path'];
const pose3dArray: readonly FieldRoleId[] = ['points', 'path', 'parts'];
const mechanism: readonly FieldRoleId[] = ['side', 'front', 'top'];
const translationArray: readonly FieldRoleId[] = ['path', 'points'];
const shape: readonly FieldRoleId[] = ['shape'];

/** Roles each type can take, the inferred one first */
const typeRoles: Partial<Record<string, readonly FieldRoleId[]>> = {
	'struct:Pose2d': pose,
	'struct:Pose3d': pose3d,
	'struct:Pose2d[]': poseArray,
	'struct:Pose3d[]': pose3dArray,
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
	let ids = entry.kind === 'mechanism2d' ? mechanism : (typeRoles[entry.type] ?? []);
	const lastName = entry.name.slice(entry.name.lastIndexOf('/') + 1);
	// Arrays named like AdvantageKit's `Components` place a robot's parts, and like PathPlanner's `activePath` or
	// Choreo's `Trajectory` are paths, not separate points
	const first = ids.includes('parts') && /component/iu.test(lastName) ? 'parts' : undefined;
	const inferred = first ?? (ids.includes('path') && /path|trajectory/iu.test(lastName) ? 'path' : undefined);
	if (inferred !== undefined) {
		ids = [inferred, ...ids.filter((id) => id !== inferred)];
	}
	return ids.map((id) => ({ id, label: field[id].label }));
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

const connects: Partial<Record<string, Connects>> = {
	robot: 'carrier',
	ghost: 'carrier',
	point: 'single',
	points: 'many',
	path: 'many',
	parts: 'attached',
	side: 'attached',
	front: 'attached',
	top: 'attached',
};

/**
 * Single poses and translations can be connected to anything but shapes, which can't be connected, and parts and
 * mechanisms are attached to robots and ghosts
 */
export function fieldConnects(binding: WidgetBinding): Connects | undefined {
	return binding.role && connects[binding.role.id];
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
