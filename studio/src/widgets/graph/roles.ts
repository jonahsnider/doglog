import type { Entry } from '@/data/data-store';
import { inferUnit } from '@/data/units';
import { widgetRoles } from '@/widgets/widget-info';
import type { RoleOption, WidgetBinding } from '@/widgets/widget-type';

export type GraphSection = 'left' | 'right' | 'discrete';

const { left, right, discrete } = widgetRoles.graph;

/** Numbers are plotted on an axis unless moved, booleans and strings can only be bands */
export function graphRoles(entry: Entry): readonly RoleOption[] {
	if (entry.kind === 'number') {
		return [left, right, discrete];
	}
	return entry.kind === 'boolean' || entry.kind === 'string' ? [discrete] : [];
}

export function graphSection(role: RoleOption | undefined): GraphSection {
	return role?.id === 'right' || role?.id === 'discrete' ? role.id : 'left';
}

/** Numbers go on the right axis when they measure something else than the left axis, ex. amps beside meters per second */
export function inferGraphRole(
	roles: readonly RoleOption[],
	earlier: readonly WidgetBinding[],
	entry: Entry,
): RoleOption | undefined {
	if (!roles.includes(right)) {
		return undefined;
	}
	const first = earlier.find((binding) => binding.entry !== undefined && graphSection(binding.role) === 'left')?.entry;
	const leftUnit = first && inferUnit(first);
	const unit = inferUnit(entry);
	return leftUnit && unit && leftUnit.measure !== unit.measure ? right : left;
}
