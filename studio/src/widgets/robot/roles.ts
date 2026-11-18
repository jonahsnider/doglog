import type { Entry } from '@/data/data-store';
import type { MechanismPlane } from '@/three/mechanism-3d';
import { widgetOptions, widgetRoles } from '@/widgets/widget-info';
import type { RoleOption, WidgetBinding, WidgetOption } from '@/widgets/widget-type';

const { side, front, top, parts: partsRole } = widgetRoles.robot;

/** The robot plane a mechanism is drawn on in 3D, XZ (seen from its side) first since it's inferred */
const planes: readonly (RoleOption & { id: MechanismPlane })[] = [side, front, top];

const parts: readonly RoleOption[] = [partsRole];

export function robotRoles(entry: Entry): readonly RoleOption[] {
	if (entry.kind === 'mechanism2d') {
		return planes;
	}
	return entry.type === 'struct:Pose3d[]' ? parts : [];
}

export function mechanismPlane(binding: WidgetBinding): MechanismPlane {
	return planes.find((plane) => plane.id === binding.role?.id)?.id ?? 'side';
}

/** Whether the robot is drawn in 2D or 3D, 2D when the only entry is a mechanism */
export const viewOption: WidgetOption = {
	...widgetOptions.robot.view,
	infer: (bindings) => (bindings.length === 1 && bindings[0]?.entry?.kind !== 'struct[]' ? '2d' : '3d'),
};
