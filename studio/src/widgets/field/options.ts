import { getEntry } from '@/data/data-store';
import { panes, type PaneNode } from '@/panes/layout';
import { widgetBindings } from '@/widgets/bindings';
import { orientedField, wpilibCoordinates, xAxisAngle } from '@/widgets/field/geometry';
import { roles3d } from '@/widgets/field/roles';
import { optionValues } from '@/widgets/options';
import { type WidgetTypeId, widgetOptions } from '@/widgets/widget-info';
import type { WidgetOption } from '@/widgets/widget-type';

/**
 * Where robots publish their WPILib version: WPILib's NetworkTables topic, and AdvantageKit's system stats (27.0.0-alpha-7
 * onward) in its log, streamed over NetworkTables, and logged from NetworkTables
 */
const wpilibVersionNames = [
	'/NT:/Robot/WPILibVersion',
	'/Robot/WPILibVersion',
	'/SystemStats/Versions/WPILib',
	'/AdvantageKit/SystemStats/Versions/WPILib',
	'/NT:/AdvantageKit/SystemStats/Versions/WPILib',
];

/** The WPILib version the robot published, in a log or a live session */
function wpilibVersion(): unknown {
	return wpilibVersionNames
		.map((name) => getEntry(name))
		.find((entry) => entry !== undefined)
		?.samples.valueAt(Infinity);
}

export const fieldOptions: readonly WidgetOption[] = [
	// Parts and mechanisms are only drawn in 3D
	{
		...widgetOptions.field.view,
		infer: (bindings) =>
			bindings.some((binding) => binding.role !== undefined && roles3d.has(binding.role.id)) ? '3d' : undefined,
	},
	{ ...widgetOptions.field.coordinates, infer: () => wpilibCoordinates(wpilibVersion()) },
	// WPILib 2027 draws the field with red on the left, so +X points right in either coordinates
	{
		...widgetOptions.field.orientation,
		dropdown: true,
		infer: (_, earlier) => (earlier['coordinates'] === 'center' ? 'red-left' : 'blue-left'),
	},
	widgetOptions.field.stagedGamePieces,
	{ ...widgetOptions.field.fov, dropdown: true },
];

/**
 * Where logged +X points on the first field widget in `layout` showing `entryName` or an entry it's a field of, ex.
 * `/Drive/Pose` for `/Drive/Pose/rotation` (see `xAxisAngle()`), so other widgets can turn to match it. `undefined`
 * when no field widget shows it.
 */
export function fieldXAxisAngle(layout: PaneNode, entryName: string): number | undefined {
	const widget = panes(layout).find(
		(pane) =>
			pane.widget?.type === ('field' satisfies WidgetTypeId) &&
			widgetBindings(pane.widget).some(({ name }) => entryName === name || entryName.startsWith(`${name}/`)),
	)?.widget;
	if (widget === undefined) {
		return undefined;
	}
	// Neither option is inferred from bindings
	const options = optionValues({ options: fieldOptions }, widget, []);
	return xAxisAngle(
		orientedField(options['orientation']),
		options['coordinates'] === 'center' ? 'center' : 'blue-wall',
	);
}
