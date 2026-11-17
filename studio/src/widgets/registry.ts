import { ChartNoAxesGanttIcon, MapIcon, MoveIcon, NotebookPenIcon, TableIcon, TerminalIcon } from 'lucide-react';
import { createWidget } from '@/bindings';
import type { Entry } from '@/data/data-store';
import type { Widget } from '@/pane-layout';
import { Console } from '@/widgets/console';
import { DiscreteTimeline } from '@/widgets/discrete-timeline';
import { Field } from '@/widgets/field';
import { fieldRoles } from '@/widgets/field-roles';
import { Notepad } from '@/widgets/notepad';
import { Swerve } from '@/widgets/swerve';
import { swerveRoles } from '@/widgets/swerve-data';
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
		component: ValuesTable,
	},
	{
		id: 'console',
		name: 'Console',
		icon: TerminalIcon,
		hotkey: 'C',
		accepts: ['string'],
		// WPILib's console output and Driver Station messages
		defaultEntryNames: ['/console', '/messages'],
		component: Console,
	},
	{
		id: 'discrete-timeline',
		name: 'Discrete timeline',
		icon: ChartNoAxesGanttIcon,
		hotkey: 'D',
		accepts: ['boolean', 'string'],
		component: DiscreteTimeline,
	},
	{
		id: 'swerve',
		name: 'Swerve',
		icon: MoveIcon,
		hotkey: 'S',
		accepts: ['number', 'struct', 'struct[]'],
		roles: swerveRoles,
		component: Swerve,
	},
	{
		id: 'field',
		name: 'Field',
		icon: MapIcon,
		hotkey: 'F',
		accepts: ['struct', 'struct[]'],
		roles: fieldRoles,
		rendersEmpty: true,
		component: Field,
	},
	{
		id: 'notepad',
		name: 'Notepad',
		icon: NotebookPenIcon,
		hotkey: 'N',
		accepts: [],
		rendersEmpty: true,
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

	if (swerveRoles(entry)[0]?.id === 'states') {
		return 'swerve';
	}

	if (fieldRoles(entry).length > 0) {
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

	return createWidget(getWidgetType(defaultWidgetTypeId(entry))!, [entry.name]);
}
