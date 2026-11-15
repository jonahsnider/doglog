import { ChartNoAxesGanttIcon, TableIcon, TerminalIcon } from 'lucide-react';
import { Console } from '@/widgets/console';
import { DiscreteTimeline } from '@/widgets/discrete-timeline';
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
];

export function getWidgetType(id: string): WidgetType | undefined {
	return widgetTypes.find((type) => type.id === id);
}
