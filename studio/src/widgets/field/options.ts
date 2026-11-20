import { getEntry } from '@/data/data-store';
import { wpilibCoordinates } from '@/widgets/field/geometry';
import { widgetOptions } from '@/widgets/widget-info';
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
	{ ...widgetOptions.field.coordinates, infer: () => wpilibCoordinates(wpilibVersion()) },
	// WPILib 2027 draws the field with red on the left, so +X points right in either coordinates
	{
		...widgetOptions.field.orientation,
		dropdown: true,
		infer: (_, earlier) => (earlier['coordinates'] === 'center' ? 'red-left' : 'blue-left'),
	},
];
