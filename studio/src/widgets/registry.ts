import BotIcon from 'lucide-react/icons/bot';
import ChartLineIcon from 'lucide-react/icons/chart-line';
import Gamepad2Icon from 'lucide-react/icons/gamepad-2';
import MapIcon from 'lucide-react/icons/map';
import NotebookPenIcon from 'lucide-react/icons/notebook-pen';
import TableIcon from 'lucide-react/icons/table';
import TerminalIcon from 'lucide-react/icons/terminal';
import { lazy } from 'react';
import { createWidget } from '@/widgets/bindings';
import type { Entry } from '@/data/data-store';
import type { Widget } from '@/panes/layout';
import { Console } from '@/widgets/console/console';
import { Controller } from '@/widgets/controller/controller';
import { controllerPort } from '@/widgets/controller/data';
import { controllerOptionFromEntry, controllerOptions, controllerTypeId } from '@/widgets/controller/options';
import { Field } from '@/widgets/field/field';
import { fieldOptions } from '@/widgets/field/options';
import { fieldConnects, fieldRoles, inferFieldRole } from '@/widgets/field/roles';
import { Graph } from '@/widgets/graph/graph';
import { graphRoles, inferGraphRole } from '@/widgets/graph/roles';
import { robotOption } from '@/widgets/robot/robot-option';
import { robotRoles, viewOption } from '@/widgets/robot/roles';
import { Swerve } from '@/widgets/swerve/swerve';
import SwerveDriveIcon from '@/widgets/swerve/swerve-drive.svg?react';
import { swerveRoles } from '@/widgets/swerve/data';
import { TableWidget } from '@/widgets/table/table';
import { widgetInfos, type WidgetTypeId } from '@/widgets/widget-info';
import type { WidgetType } from '@/widgets/widget-type';

/** The parts of a widget type agents know about too, see `@/widgets/widget-info` */
function info(id: WidgetTypeId): Pick<WidgetType, 'id' | 'name' | 'accepts' | 'options'> {
	const { name, accepts, options } = widgetInfos.find((other) => other.id === id)!;
	return { id, name, accepts, options };
}

const loadRobot = async () => ({ default: (await import('@/widgets/robot/robot')).Robot });
const loadNotepad = async () => ({ default: (await import('@/widgets/notepad/notepad')).Notepad });

/** Every widget type, in the order they're listed in the widget picker */
export const widgetTypes: readonly WidgetType[] = [
	{
		...info('graph'),
		icon: ChartLineIcon,
		hotkey: 'G',
		roles: graphRoles,
		inferRole: inferGraphRole,
		component: Graph,
	},
	{
		...info('field'),
		icon: MapIcon,
		hotkey: 'F',
		roles: fieldRoles,
		inferRole: inferFieldRole,
		connects: fieldConnects,
		rendersEmpty: true,
		options: fieldOptions,
		component: Field,
	},
	{
		...info('robot'),
		icon: BotIcon,
		hotkey: 'R',
		roles: robotRoles,
		rendersEmpty: true,
		options: [viewOption, robotOption],
		preload: loadRobot,
		component: lazy(loadRobot),
	},
	{ ...info('table'), icon: TableIcon, hotkey: 'T', component: TableWidget },
	{
		...info('console'),
		icon: TerminalIcon,
		hotkey: 'C',
		// WPILib's console output and Driver Station messages
		defaultEntryNames: ['/console', '/messages'],
		component: Console,
	},
	{ ...info('swerve'), icon: SwerveDriveIcon, hotkey: 'S', roles: swerveRoles, component: Swerve },
	{
		...info(controllerTypeId),
		icon: Gamepad2Icon,
		rendersEmpty: true,
		options: controllerOptions,
		optionFromEntry: controllerOptionFromEntry,
		title: (options) => `Controller ${options['controller']}`,
		component: Controller,
	},
	{
		...info('notepad'),
		icon: NotebookPenIcon,
		hotkey: 'N',
		rendersEmpty: true,
		preload: loadNotepad,
		component: lazy(loadNotepad),
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

	return 'table';
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
