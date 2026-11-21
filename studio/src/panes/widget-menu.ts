import { use, useEffect } from 'react';
import type { MenuEntry } from '@/components/app-context-menu';
import { WidgetBindingsContext } from '@/entries/drag';
import type { WidgetBinding } from '@/widgets/widget-type';

/** Items a widget adds to its pane's context menu, for the binding right-clicked if there's one */
type WidgetMenu = (binding: WidgetBinding | undefined) => readonly MenuEntry[];

/** Each pane's widget's menu items, by pane ID */
const menus = new Map<string, WidgetMenu>();

/** The items the widget in a pane adds to its context menu, see `useWidgetMenu()` */
export function widgetMenuItems(paneId: string, binding: WidgetBinding | undefined): readonly MenuEntry[] {
	return menus.get(paneId)?.(binding) ?? [];
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
