import type { Entry } from '@/data/data-store';
import type { MechanismPlane } from '@/three/mechanism-3d';
import type { RoleOption, WidgetBinding, WidgetOption } from '@/widgets/widget-type';

/** The plane a mechanism is drawn on in 3D, Side first since it's inferred */
const planes: readonly (RoleOption & { id: MechanismPlane })[] = [
	{ id: 'side', label: 'Side' },
	{ id: 'front', label: 'Front' },
	{ id: 'top', label: 'Top' },
];

const parts: readonly RoleOption[] = [{ id: 'parts', label: 'Parts' }];

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
	kind: 'choice',
	id: 'view',
	label: 'View',
	choices: [
		{ id: '2d', label: '2D' },
		{ id: '3d', label: '3D' },
	],
	default: '3d',
	infer: (bindings) => (bindings.length === 1 && bindings[0]?.entry?.kind !== 'struct[]' ? '2d' : '3d'),
};
