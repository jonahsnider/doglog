import { getEntry, type Entry } from '@/data/data-store';
import { type PaneNode, panes } from '@/panes/layout';
import { pickedOption } from '@/widgets/options';
import {
	controllerPort,
	controllerPorts,
	findController,
	hasControllerData,
	inferLayout,
} from '@/widgets/controller/data';
import type { WidgetOption, WidgetType } from '@/widgets/widget-type';

export const controllerTypeId = 'controller';

const controllerOption: WidgetOption = {
	kind: 'choice',
	id: 'controller',
	label: 'Controller',
	choices: controllerPorts.map((port) => ({ id: String(port), label: String(port) })),
	default: '0',
	initial: (layout) => nextController(layout, getEntry),
};

/**
 * The first controller another controller widget in `layout` doesn't show, preferring ones that were plugged in, so
 * adding controller widgets shows the driver's controller, then the operator's
 */
export function nextController(layout: PaneNode, entryOf: (name: string) => Entry | undefined): string {
	const shown = new Set(
		panes(layout).flatMap(({ widget }) =>
			widget?.type === controllerTypeId ? [pickedOption(widget, controllerOption) ?? controllerOption.default] : [],
		),
	);
	const free = controllerPorts.filter((port) => !shown.has(String(port)));
	const port = free.find((other) => hasControllerData(findController(other, entryOf))) ?? free[0] ?? 0;
	return String(port);
}

export const controllerOptions: readonly WidgetOption[] = [
	controllerOption,
	{
		kind: 'choice',
		id: 'layout',
		label: 'Layout',
		choices: [
			{ id: 'xbox', label: 'Xbox' },
			{ id: 'playstation', label: 'PlayStation' },
		],
		default: 'xbox',
		infer: (_, earlier) => inferLayout(findController(Number(earlier['controller']), getEntry)),
	},
];

export const controllerOptionFromEntry: WidgetType['optionFromEntry'] = (name) => {
	const port = controllerPort(name);
	return port === undefined ? undefined : { id: controllerOption.id, value: String(port) };
};
