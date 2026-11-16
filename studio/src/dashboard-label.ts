import type { Dashboard } from '@/dashboards';
import type { PaneNode, Widget } from '@/pane-layout';
import { getWidgetType } from '@/widgets/registry';
import { widgetConfigSchema, type WidgetType } from '@/widgets/widget-type';

/**
 * Prefixes skipped when naming a dashboard after its entries, since nearly every DogLog or AdvantageKit entry starts
 * with them. Longer prefixes come first.
 */
const skippedPrefixes = ['/AdvantageKit/RealOutputs/', '/AdvantageKit/', '/RealOutputs/', '/Robot/'];

/** How many topics are listed by name before the rest are counted */
const maxTopics = 3;

/** An entry's topic is its first path segment, ex. `/Robot/Intake/Speed` is about `Intake` */
function entryTopic(name: string): string {
	const prefix = skippedPrefixes.find((candidate) => name.startsWith(candidate));
	const [topic = name] = (prefix === undefined ? name.replace(/^\//u, '') : name.slice(prefix.length)).split('/');
	return topic.charAt(0).toUpperCase() + topic.slice(1);
}

/**
 * A name for a dashboard based on the entries it shows, ex. `/Robot/Localization/Pose` and `/Robot/Intake/Speed` give
 * `Localization & Intake`. Widgets without entries, or with only their type's default entries (ex. a console showing
 * `/console` and `/messages`), are named after their type.
 */
export function suggestDashboardName(layout: PaneNode): string {
	const topics = new Set<string>();
	for (const { widget } of widgetAreas(layout)) {
		const type = getWidgetType(widget.type);
		const { entryNames } = widgetConfigSchema.parse(widget.config);
		const defaults = new Set(type?.defaultConfig.entryNames);
		const isDefault = entryNames.length === defaults.size && entryNames.every((name) => defaults.has(name));
		if (isDefault) {
			topics.add(type?.name ?? 'Unknown widget');
			continue;
		}
		for (const name of entryNames) {
			topics.add(entryTopic(name));
		}
	}

	const names = [...topics];
	if (names.length === 0) {
		return 'Empty dashboard';
	}
	if (names.length > maxTopics) {
		return `${names.slice(0, maxTopics - 1).join(', ')} & ${names.length - maxTopics + 1} more`;
	}
	return names.length === 1 ? names[0]! : `${names.slice(0, -1).join(', ')} & ${names.at(-1)}`;
}

/** The name the user gave a dashboard, or one suggested from its contents */
export function dashboardName(dashboard: Dashboard): string {
	return dashboard.name ?? suggestDashboardName(dashboard.layout);
}

/** Each widget with the fraction of the dashboard's area its pane takes up, in layout order (top left first) */
function widgetAreas(layout: PaneNode, area = 1): { widget: Widget; area: number }[] {
	if (layout.kind === 'pane') {
		return layout.widget === undefined ? [] : [{ widget: layout.widget, area }];
	}

	return [...widgetAreas(layout.first, area * layout.ratio), ...widgetAreas(layout.second, area * (1 - layout.ratio))];
}

/** The widget type in the dashboard's biggest pane, the first one in the layout on ties. Its icon represents the dashboard. */
export function mainWidgetType(layout: PaneNode): WidgetType | undefined {
	let main: WidgetType | undefined;
	let max = 0;
	for (const { widget, area } of widgetAreas(layout)) {
		const type = getWidgetType(widget.type);
		if (type && area > max) {
			main = type;
			max = area;
		}
	}
	return main;
}
