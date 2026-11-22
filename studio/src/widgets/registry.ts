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
import { widgetIcons } from '@/widgets/icons';
import { graphRoles, inferGraphRole } from '@/widgets/graph/roles';
import { robotOption } from '@/widgets/robot/robot-option';
import { robotRoles, viewOption } from '@/widgets/robot/roles';
import { Swerve } from '@/widgets/swerve/swerve';
import { swerveRoles } from '@/widgets/swerve/data';
import { TableWidget } from '@/widgets/table/table';
import { videoOptions } from '@/widgets/video/video-options';
import { type WidgetInfo, widgetInfos, type WidgetTypeId } from '@/widgets/widget-info';
import type { WidgetType } from '@/widgets/widget-type';

/** The parts of a widget type agents and link previews know about too, see `@/widgets/widget-info` */
function info(
	id: WidgetTypeId,
): Pick<WidgetType, 'id' | 'name' | 'icon' | 'accepts' | 'options' | 'defaultEntryNames' | 'title'> {
	const { name, accepts, options, defaultEntryNames, title }: WidgetInfo = widgetInfos.find(
		(other) => other.id === id,
	)!;
	return { id, name, icon: widgetIcons[id], accepts, options, defaultEntryNames, title };
}

const loadRobot = async () => ({ default: (await import('@/widgets/robot/robot')).Robot });
const loadNotepad = async () => ({ default: (await import('@/widgets/notepad/notepad')).Notepad });
const loadVideo = async () => ({ default: (await import('@/widgets/video/video')).Video });

/** Every widget type, in the order they're listed in the widget picker */
export const widgetTypes: readonly WidgetType[] = [
	{
		...info('graph'),
		hotkey: 'G',
		roles: graphRoles,
		inferRole: inferGraphRole,
		component: Graph,
	},
	{
		...info('field'),
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
		hotkey: 'R',
		roles: robotRoles,
		rendersEmpty: true,
		options: [viewOption, robotOption],
		preload: loadRobot,
		component: lazy(loadRobot),
	},
	{ ...info('table'), hotkey: 'T', component: TableWidget },
	{ ...info('console'), hotkey: 'C', component: Console },
	{ ...info('swerve'), hotkey: 'S', roles: swerveRoles, component: Swerve },
	{
		...info(controllerTypeId),
		rendersEmpty: true,
		options: controllerOptions,
		optionFromEntry: controllerOptionFromEntry,
		component: Controller,
	},
	{
		...info('notepad'),
		hotkey: 'N',
		rendersEmpty: true,
		preload: loadNotepad,
		component: lazy(loadNotepad),
	},
	{
		...info('video'),
		hotkey: 'V',
		rendersEmpty: true,
		options: videoOptions,
		preload: loadVideo,
		component: lazy(loadVideo),
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
