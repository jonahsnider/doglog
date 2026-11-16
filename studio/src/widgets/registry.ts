import { ChartNoAxesGanttIcon, MoveIcon, TableIcon, TerminalIcon } from 'lucide-react';
import type { Entry } from '@/data/data-store';
import type { Widget } from '@/pane-layout';
import { Console } from '@/widgets/console';
import { DiscreteTimeline } from '@/widgets/discrete-timeline';
import { Swerve } from '@/widgets/swerve';
import { swerveRole } from '@/widgets/swerve-data';
import { ValuesTable } from '@/widgets/values-table';
import { bindableKinds, type WidgetType } from '@/widgets/widget-type';

/** Every widget type, in the order they're listed in the widget picker */
export const widgetTypes: readonly WidgetType[] = [
	{
		id: 'values-table',
		name: 'Values table',
		icon: TableIcon,
		accepts: bindableKinds,
		defaultConfig: { entries: [] },
		component: ValuesTable,
	},
	{
		id: 'console',
		name: 'Console',
		icon: TerminalIcon,
		accepts: ['string'],
		// WPILib's console output and Driver Station messages
		defaultConfig: { entries: ['/console', '/messages'] },
		component: Console,
	},
	{
		id: 'discrete-timeline',
		name: 'Discrete timeline',
		icon: ChartNoAxesGanttIcon,
		accepts: ['boolean', 'string'],
		defaultConfig: { entries: [] },
		component: DiscreteTimeline,
	},
	{
		id: 'swerve',
		name: 'Swerve',
		icon: MoveIcon,
		accepts: ['number', 'struct', 'struct[]'],
		matches: (entry) => swerveRole(entry) !== undefined,
		defaultConfig: { entries: [] },
		component: Swerve,
	},
];

export function getWidgetType(id: string): WidgetType | undefined {
	return widgetTypes.find((type) => type.id === id);
}

function defaultWidgetTypeId(entry: Entry): string {
	if (entry.kind === 'string' && (entry.name === '/console' || entry.name === '/messages')) {
		return 'console';
	}

	if (entry.kind === 'string' || entry.kind === 'boolean') {
		return 'discrete-timeline';
	}

	if (entry.type === 'struct:SwerveModuleState[]' || entry.type === 'struct:SwerveModuleVelocity[]') {
		return 'swerve';
	}

	// Numeric entries (`entry.kind === 'number'`) should use the line graph once it exists, they use the values table until then
	return 'values-table';
}

/** The widget an entry is shown in when it's added without choosing a widget, bound to only that entry. `undefined` for unsupported entries. */
export function defaultWidget(entry: Entry): Widget | undefined {
	if (entry.kind === 'unsupported') {
		return undefined;
	}

	const type = getWidgetType(defaultWidgetTypeId(entry))!;
	return { type: type.id, config: { ...type.defaultConfig, entries: [entry.name] } };
}
