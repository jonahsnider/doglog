import {
	BotIcon,
	ChartLineIcon,
	Gamepad2Icon,
	MapIcon,
	MoveIcon,
	NotebookPenIcon,
	TableIcon,
	TerminalIcon,
} from 'lucide-react';
import { createWidget } from '@/widgets/bindings';
import type { Entry } from '@/data/data-store';
import type { Widget } from '@/panes/layout';
import { Console } from '@/widgets/console/console';
import { Controller } from '@/widgets/controller/controller';
import { controllerPort } from '@/widgets/controller/data';
import { controllerOptionFromEntry, controllerOptions, controllerTypeId } from '@/widgets/controller/options';
import { Field } from '@/widgets/field/field';
import { fieldConnects, fieldRoles, inferFieldRole } from '@/widgets/field/roles';
import { Graph } from '@/widgets/graph/graph';
import { graphRoles, inferGraphRole } from '@/widgets/graph/roles';
import { Notepad } from '@/widgets/notepad/notepad';
import { Robot } from '@/widgets/robot/robot';
import { Swerve } from '@/widgets/swerve/swerve';
import { swerveRoles } from '@/widgets/swerve/data';
import { ValuesTable } from '@/widgets/values-table/values-table';
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
		id: 'graph',
		name: 'Graph',
		icon: ChartLineIcon,
		hotkey: 'D',
		accepts: ['number', 'boolean', 'string'],
		roles: graphRoles,
		inferRole: inferGraphRole,
		component: Graph,
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
		inferRole: inferFieldRole,
		connects: fieldConnects,
		rendersEmpty: true,
		options: [
			{
				kind: 'choice',
				id: 'orientation',
				label: 'Orientation',
				choices: [
					{ id: 'blue-left', label: 'Blue left' },
					{ id: 'red-left', label: 'Red left' },
				],
				default: 'blue-left',
			},
		],
		component: Field,
	},
	{
		id: 'robot',
		name: 'Robot',
		icon: BotIcon,
		hotkey: 'R',
		accepts: ['mechanism2d'],
		component: Robot,
	},
	{
		id: controllerTypeId,
		name: 'Controller',
		icon: Gamepad2Icon,
		hotkey: 'G',
		accepts: [],
		rendersEmpty: true,
		options: controllerOptions,
		optionFromEntry: controllerOptionFromEntry,
		title: (options) => `Controller ${options['controller']}`,
		component: Controller,
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

	if (entry.kind === 'number' || entry.kind === 'string' || entry.kind === 'boolean') {
		return 'graph';
	}

	if (swerveRoles(entry)[0]?.id === 'states') {
		return 'swerve';
	}

	if (entry.kind === 'mechanism2d') {
		return 'robot';
	}

	if (fieldRoles(entry).length > 0) {
		return 'field';
	}

	return 'values-table';
}

/** The widget an entry is shown in when it's added without choosing a widget, bound to only that entry. `undefined` for unsupported entries. */
export function defaultWidget(entry: Entry): Widget | undefined {
	if (entry.kind === 'unsupported') {
		return undefined;
	}

	const port = controllerPort(entry.name);
	if (port !== undefined) {
		return createWidget(getWidgetType(controllerTypeId)!, [], { controller: String(port) });
	}

	return createWidget(getWidgetType(defaultWidgetTypeId(entry))!, [entry.name]);
}
