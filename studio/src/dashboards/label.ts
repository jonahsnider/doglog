// Dashboard names and main widget types. Free of React, so link previews can name dashboards on the server.
import { split } from 'change-case';
import { widgetBindings } from '@/widgets/bindings';
import type { DashboardContents } from '@/dashboards/doc';
import type { PaneNode, Widget } from '@/panes/layout';
import { childSizes } from '@/panes/split-sizes';
import { optionValues } from '@/widgets/options';
import { getWidgetInfo, type KnownWidgetInfo } from '@/widgets/widget-info';
import { widgetTitle } from '@/widgets/widget-type';

/**
 * Path segments skipped when naming a dashboard after its entries, since they group entries without saying what
 * they're about, ex. DogLog's `/Robot`, AdvantageKit's `/AdvantageKit/RealOutputs`, NetworkTables entries logged
 * under `/NT:`, and DogLog's tunables under `/Robot/Tunable`
 */
const skippedSegments = new Set([
	'NT:',
	'AdvantageKit',
	'RealOutputs',
	'Robot',
	'SmartDashboard',
	'Shuffleboard',
	'Tunable',
]);

/**
 * Names with their own spelling, kept as written instead of in sentence case, keyed by their letters in lowercase. Many
 * can't be split into words by their capitals, ex. `CANcoder` would be `CA ncoder`.
 */
const knownNames = new Map(
	[
		'AprilTag',
		'AprilTags',
		'CANcoder',
		'CANdle',
		'CANivore',
		'CANrange',
		'DogLog',
		'Driver Station',
		'LEDs',
		'navX',
		'PathPlanner',
		'PhotonVision',
		'QuestNav',
		'roboRIO',
		'SPARK Flex',
		'SPARK MAX',
		'SysId',
		'Systemcore',
		'WPILib',
	].map((name) => [name.replaceAll(' ', '').toLowerCase(), name]),
);

/** The known name some words spell, ex. `CA` and `Ncoder` spell `CANcoder` */
function knownName(words: readonly string[]): string | undefined {
	return knownNames.get(words.join('').toLowerCase());
}

const maxTopics = 3;

/** Joins topics like `A, B, & C` */
const topicList = new Intl.ListFormat('en', { style: 'short', type: 'conjunction' });

/**
 * An entry's topic is its first path segment after skipped ones in sentence case, ex. `/Robot/HopperManager/State` is
 * about `Hopper manager`. Words in all caps are kept as acronyms, ex. `FMSInfo` gives `FMS info`, and known names keep
 * their spelling, ex. `TopLeds` gives `Top LEDs`. WPILib's Driver Station entries, ex. `/DS:enabled`, are about the
 * `Driver Station`.
 */
function entryTopic(name: string): string {
	const segments = name.split('/').filter((segment) => segment !== '');
	const segment = segments.find((candidate) => !skippedSegments.has(candidate)) ?? segments.at(-1) ?? name;
	if (segment.startsWith('DS:')) {
		return 'Driver Station';
	}

	const words = split(segment);
	const topic: string[] = [];
	let start = 0;
	while (start < words.length) {
		// The longest run of words that spells a known name
		let end = words.length;
		while (end > start && knownName(words.slice(start, end)) === undefined) {
			end--;
		}
		const known = knownName(words.slice(start, end));
		if (known === undefined) {
			const word = words[start]!;
			const cased = word === word.toUpperCase() ? word : word.toLowerCase();
			topic.push(topic.length === 0 ? cased.charAt(0).toUpperCase() + cased.slice(1) : cased);
			start++;
		} else {
			topic.push(known);
			start = end;
		}
	}
	return topic.length === 0 ? segment : topic.join(' ');
}

function entryTopics(widget: Widget): string[] | undefined {
	const entryNames = new Set(widgetBindings(widget).map((binding) => binding.name));
	const defaults = new Set(getWidgetInfo(widget.type)?.defaultEntryNames);
	const isDefault = entryNames.size === defaults.size && [...entryNames].every((name) => defaults.has(name));
	return isDefault ? undefined : [...entryNames].map((name) => entryTopic(name));
}

/** Lists topics like `A, B, & C`, the most common first, then in order. `undefined` without any. */
function listTopics(topicNames: readonly string[]): string | undefined {
	// Keyed by lowercase name so `Debug` and `DEBUG` are one topic
	const topics = new Map<string, { name: string; entries: number }>();
	for (const name of topicNames) {
		const topic = topics.get(name.toLowerCase());
		if (topic) {
			topic.entries++;
		} else {
			topics.set(name.toLowerCase(), { name, entries: 1 });
		}
	}

	// Sorting is stable, so topics with as many entries stay in order
	const names = [...topics.values()].toSorted((a, b) => b.entries - a.entries).map((topic) => topic.name);
	if (names.length === 0) {
		return undefined;
	}
	if (names.length > maxTopics) {
		return topicList.format([...names.slice(0, maxTopics - 1), `${names.length - maxTopics + 1} more`]);
	}
	return topicList.format(names);
}

/**
 * A name for a dashboard based on the entries it shows, ex. `/Robot/Localization/Pose` and `/Robot/Intake/Speed` give
 * `Localization & Intake`. Topics with the most entries come first, then in layout order. Widgets without entries, or
 * with only their type's default entries (ex. a console showing `/console` and `/messages`), are named after their type.
 */
export function suggestDashboardName(layout: PaneNode): string {
	const topics = widgetAreas(layout).flatMap(({ widget }) => {
		const type = getWidgetInfo(widget.type);
		return entryTopics(widget) ?? [type ? widgetTitle(type, optionValues(type, widget, [])) : 'Unknown widget'];
	});
	return listTopics(topics) ?? 'Empty dashboard';
}

/**
 * A name for the entries a widget shows, named like dashboards are, ex. `Localization & Intake`. `undefined` for
 * widgets without entries or with only their type's default ones, which their type's name already describes.
 */
export function suggestWidgetName(widget: Widget): string | undefined {
	const topics = entryTopics(widget);
	return topics && listTopics(topics);
}

/** The name the user gave a dashboard, or one suggested from its contents */
export function dashboardName(dashboard: DashboardContents): string {
	return dashboard.name ?? suggestDashboardName(dashboard.layout);
}

/** Each widget with the fraction of the dashboard's area its pane takes up, in layout order (top left first) */
function widgetAreas(layout: PaneNode, area = 1): { widget: Widget; area: number }[] {
	if (layout.kind === 'pane') {
		return layout.widget === undefined ? [] : [{ widget: layout.widget, area }];
	}

	const sizes = childSizes(layout);
	return layout.children.flatMap((child, index) => widgetAreas(child, area * (sizes[index] ?? 0)));
}

/** The widget type in the dashboard's biggest pane, the first one in the layout on ties. Its icon represents the dashboard. */
export function mainWidgetType(layout: PaneNode): KnownWidgetInfo | undefined {
	let main: KnownWidgetInfo | undefined;
	let max = 0;
	for (const { widget, area } of widgetAreas(layout)) {
		const type = getWidgetInfo(widget.type);
		if (type && area > max) {
			main = type;
			max = area;
		}
	}
	return main;
}
