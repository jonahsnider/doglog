import { useEffect, useMemo } from 'react';
import type { Dashboard } from '@/dashboards/dashboards';
import { updateLayout } from '@/dashboards/panes';
import type { Entry } from '@/data/data-store';
import { stopEditing, useEditing } from '@/entries/editing';
import { findPane } from '@/panes/layout';
import { addEntries, setBoundEntries, widgetBindings } from '@/widgets/bindings';
import { getWidgetType } from '@/widgets/registry';
import { bindsEntries, type WidgetType } from '@/widgets/widget-type';

/** The widget whose entries the entry browser is editing, see `startEditing()` */
export type EditedWidget = {
	type: WidgetType;
	/** Names of the entries the widget shows */
	bound: readonly string[];
	/** Bind or unbind every binding of an entry */
	setBound: (name: string, bound: boolean) => void;
};

/** The widget being edited in this dashboard, `undefined` when its pane was closed or its widget doesn't take entries anymore */
export function useEditedWidget(dashboard: Dashboard): EditedWidget | undefined {
	const editing = useEditing();
	const pane = editing?.dashboardId === dashboard.id ? findPane(dashboard.layout, editing.paneId) : undefined;
	const type = pane?.widget && getWidgetType(pane.widget.type);
	const edited = type && bindsEntries(type) ? type : undefined;
	const stale = editing !== undefined && edited === undefined;
	// Opening another dashboard, closing the pane, or changing its widget stops editing
	useEffect(() => {
		if (stale) {
			stopEditing();
		}
	}, [stale]);

	const widget = pane?.widget;
	return useMemo(() => {
		if (edited === undefined || editing === undefined) {
			return undefined;
		}
		const { dashboardId, paneId } = editing;
		const bound = [...new Set(widgetBindings(widget).map((binding) => binding.name))];
		return {
			type: edited,
			bound,
			setBound: (name, on) =>
				updateLayout(dashboardId, (layout) =>
					on
						? addEntries(layout, paneId, [name])
						: setBoundEntries(
								layout,
								paneId,
								bound.filter((other) => other !== name),
							),
				),
		};
	}, [edited, editing, widget]);
}

export function hiddenEntriesNote(all: readonly Entry[], shown: readonly Entry[], type: WidgetType): string {
	const count = all.length - shown.length;
	return `Hiding ${count} ${count === 1 ? 'entry' : 'entries'} the ${type.name.toLowerCase()} can't show`;
}

/**
 * The checkbox that changed and whether it's checked now, one changes at a time. Only entries in `toggleable` count,
 * since groups without an entry have no checkbox.
 */
export function changedCheckbox(
	bound: readonly string[],
	checked: readonly string[],
	toggleable: ReadonlySet<string>,
): { name: string; checked: boolean } | undefined {
	const was = new Set(bound);
	const now = new Set(checked);
	const added = checked.find((name) => !was.has(name) && toggleable.has(name));
	if (added !== undefined) {
		return { name: added, checked: true };
	}
	const removed = bound.find((name) => !now.has(name) && toggleable.has(name));
	return removed === undefined ? undefined : { name: removed, checked: false };
}
