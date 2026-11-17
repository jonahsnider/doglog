import { ChartNoAxesGanttIcon, MapIcon, MoveIcon, NotebookPenIcon, TableIcon, TerminalIcon } from 'lucide-react';
import type { Entry } from '@/data/data-store';
import type { Widget } from '@/pane-layout';
import { Console } from '@/widgets/console';
import { DiscreteTimeline } from '@/widgets/discrete-timeline';
import { Field } from '@/widgets/field';
import { fieldRole } from '@/widgets/field-data';
import { Notepad } from '@/widgets/notepad';
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
		hotkey: 'V',
		accepts: bindableKinds,
		defaultConfig: { entryNames: [] },
		component: ValuesTable,
	},
	{
		id: 'console',
		name: 'Console',
		icon: TerminalIcon,
		hotkey: 'C',
		accepts: ['string'],
		// WPILib's console output and Driver Station messages
		defaultConfig: { entryNames: ['/console', '/messages'] },
		component: Console,
	},
	{
		id: 'discrete-timeline',
		name: 'Discrete timeline',
		icon: ChartNoAxesGanttIcon,
		hotkey: 'D',
		accepts: ['boolean', 'string'],
		defaultConfig: { entryNames: [] },
		component: DiscreteTimeline,
	},
	{
		id: 'swerve',
		name: 'Swerve',
		icon: MoveIcon,
		hotkey: 'S',
		accepts: ['number', 'struct', 'struct[]'],
		matches: (entry) => swerveRole(entry) !== undefined,
		defaultConfig: { entryNames: [] },
		component: Swerve,
	},
	{
		id: 'field',
		name: 'Field',
		icon: MapIcon,
		hotkey: 'F',
		accepts: ['struct', 'struct[]'],
		matches: (entry) => fieldRole(entry) !== undefined,
		rendersEmpty: true,
		defaultConfig: { entryNames: [] },
		component: Field,
	},
	{
		id: 'notepad',
		name: 'Notepad',
		icon: NotebookPenIcon,
		hotkey: 'N',
		accepts: [],
		rendersEmpty: true,
		defaultConfig: { entryNames: [] },
		component: Notepad,
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

	if (fieldRole(entry) !== undefined) {
		return 'field';
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
	return { type: type.id, config: { ...type.defaultConfig, entryNames: [entry.name] } };
}
