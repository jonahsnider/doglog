import { use, useEffect } from 'react';
import type { MenuEntry, MenuPoint } from '@/components/app-context-menu';
import { WidgetBindingsContext } from '@/entries/drag';
import type { WidgetBinding } from '@/widgets/widget-type';

/** Whole-widget commands sit by Change widget; contextual commands act on the clicked target. */
type WidgetMenuItems = {
	actions?: readonly MenuEntry[];
	contextual?: readonly MenuEntry[];
};

type WidgetMenu = (
	binding: WidgetBinding | undefined,
	target: Element,
	point: MenuPoint | undefined,
) => WidgetMenuItems;

/** Each pane's widget's menu items, by pane ID */
const menus = new Map<string, WidgetMenu>();

/** The items the widget in a pane adds to its context menu, see `useWidgetMenu()` */
export function widgetMenuItems(paneId: string, ...context: Parameters<WidgetMenu>): WidgetMenuItems {
	return menus.get(paneId)?.(...context) ?? {};
}

/** Adds items to the context menu of the pane the widget is in, ex. the field's camera views */
export function useWidgetMenu(menu: WidgetMenu): void {
	const paneId = use(WidgetBindingsContext)?.paneId;
	// Updated after every render, so the items use the widget's latest state
	useEffect(() => {
		if (paneId === undefined) {
			return undefined;
		}
		menus.set(paneId, menu);
		return () => {
			if (menus.get(paneId) === menu) {
				menus.delete(paneId);
			}
		};
	});
}
