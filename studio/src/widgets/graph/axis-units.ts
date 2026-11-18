import { convertUnit, inferUnit } from '@/data/units';
import { graphSection } from '@/widgets/graph/roles';
import type { WidgetBinding } from '@/widgets/widget-type';

/** How a plotted entry's values are shown: converted to its axis's unit, labeled with the unit they're shown in */
export type SeriesUnit = { convert: (value: number) => number; label: string | undefined };

const asLogged: SeriesUnit = { convert: (value) => value, label: undefined };

function axisOf(binding: WidgetBinding): 'y' | 'y2' {
	return graphSection(binding.role) === 'right' ? 'y2' : 'y';
}

/**
 * Each axis takes the unit of its first entry. Entries measuring the same thing are converted to it, others are shown as
 * logged with their own unit.
 */
export function seriesUnits(plotted: readonly WidgetBinding[]): {
	units: ReadonlyMap<string, SeriesUnit>;
	axes: Readonly<Record<'y' | 'y2', string | undefined>>;
} {
	const axisUnits = {
		y: plotted.find((binding) => binding.entry !== undefined && axisOf(binding) === 'y'),
		y2: plotted.find((binding) => binding.entry !== undefined && axisOf(binding) === 'y2'),
	};
	const firstUnit = (axis: 'y' | 'y2') => {
		const entry = axisUnits[axis]?.entry;
		return entry && inferUnit(entry);
	};
	const axes = { y: firstUnit('y'), y2: firstUnit('y2') };

	const units = new Map<string, SeriesUnit>();
	for (const binding of plotted) {
		const unit = binding.entry && inferUnit(binding.entry);
		const axisUnit = axes[axisOf(binding)];
		if (unit && axisUnit && unit.measure === axisUnit.measure) {
			units.set(binding.id, { convert: (value) => convertUnit(value, unit, axisUnit), label: axisUnit.label });
		} else {
			units.set(binding.id, unit ? { ...asLogged, label: unit.label } : asLogged);
		}
	}
	return { units, axes: { y: axes.y?.label, y2: axes.y2?.label } };
}
