import { getEntry } from '@/data/data-store';
import { getLastRobot } from '@/three/robot-projects';
import { panes, type PaneNode } from '@/panes/layout';
import { widgetBindings } from '@/widgets/bindings';
import { orientedField, wpilibCoordinates, xAxisAngle } from '@/widgets/field/geometry';
import { roles3d } from '@/widgets/field/roles';
import { optionValues } from '@/widgets/options';
import { type WidgetTypeId, widgetOptions } from '@/widgets/widget-info';
import type { WidgetOption } from '@/widgets/widget-type';

/**
 * Where robots publish their WPILib version: WPILib's NetworkTables topic, and AdvantageKit's system stats (27.0.0-alpha-7
 * onward) in its log and over NetworkTables
 */
const wpilibVersionNames = [
	'/Robot/WPILibVersion',
	'/SystemStats/Versions/WPILib',
	'/AdvantageKit/SystemStats/Versions/WPILib',
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
	// Keep logged +X pointing right in landscape or down in portrait, in either coordinate convention.
	{
		...widgetOptions.field.orientation,
		dropdown: true,
		infer: (_, earlier, mobile) => `${earlier['coordinates'] === 'center' ? 'red' : 'blue'}-${mobile ? 'top' : 'left'}`,
	},
	widgetOptions.field.stagedGamePieces,
	widgetOptions.field.fieldBorder,
	{ ...widgetOptions.field.fov, dropdown: true },
	// Picked per robot in the legend, this is what they start as, so it has no control
	{ ...widgetOptions.field.robot, initial: getLastRobot },
];

/**
 * Where logged +X points on the first field widget in `layout` showing `entryName` or an entry it's a field of, ex.
 * `/Drive/Pose` for `/Drive/Pose/rotation` (see `xAxisAngle()`), so other widgets can turn to match it. `undefined`
 * when no field widget shows it.
 */
export function fieldXAxisAngle(layout: PaneNode, entryName: string, mobile: boolean): number | undefined {
	const widget = panes(layout).find(
		(pane) =>
			pane.widget?.type === ('field' satisfies WidgetTypeId) &&
			widgetBindings(pane.widget).some(({ name }) => entryName === name || entryName.startsWith(`${name}/`)),
	)?.widget;
	if (widget === undefined) {
		return undefined;
	}
	// Neither option is inferred from bindings
	const options = optionValues({ options: fieldOptions }, widget, [], mobile);
	return xAxisAngle(
		orientedField(options['orientation']),
		options['coordinates'] === 'center' ? 'center' : 'blue-wall',
	);
}
