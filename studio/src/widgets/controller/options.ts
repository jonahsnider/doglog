import { getEntry, type Entry } from '@/data/data-store';
import { type PaneNode, panes } from '@/panes/layout';
import { pickedOption } from '@/widgets/options';
import { controllerPort, findController, hasControllerData, inferLayout } from '@/widgets/controller/data';
import { controllerPorts, type WidgetTypeId, widgetOptions } from '@/widgets/widget-info';
import type { WidgetOption, WidgetType } from '@/widgets/widget-type';

export const controllerTypeId = 'controller' satisfies WidgetTypeId;

const controllerOption: WidgetOption = {
	...widgetOptions.controller.controller,
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
		...widgetOptions.controller.layout,
		infer: (_, earlier) => inferLayout(findController(Number(earlier['controller']), getEntry)),
	},
	widgetOptions.controller.axisValues,
];

export const controllerOptionFromEntry: WidgetType['optionFromEntry'] = (name) => {
	const port = controllerPort(name);
	return port === undefined ? undefined : { id: controllerOption.id, value: String(port) };
};
