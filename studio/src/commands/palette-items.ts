import type { Hotkey } from '@tanstack/react-hotkeys';
import FileIcon from 'lucide-react/icons/file';
import LayoutDashboardIcon from 'lucide-react/icons/layout-dashboard';
import type { ComponentType, SVGProps } from 'react';
import { type AppCommand, canRunCommand, commands } from '@/commands/app-commands';
import { dashboardShortcut } from '@/commands/commands';
import type { Dashboard } from '@/dashboards/dashboards';
import { dashboardName } from '@/dashboards/label';
import { openLogPath, openRecentLogHandle } from '@/data/open-log';
import { recentLogLabels, type useRecentLogHandles } from '@/data/recent-logs';
import type { RegisteredRouter } from '@tanstack/react-router';
import Settings2Icon from 'lucide-react/icons/settings-2';
import ShapesIcon from 'lucide-react/icons/shapes';
import ZapIcon from 'lucide-react/icons/zap';
import { paneCommandDashboard } from '@/commands/dashboard-commands';
import type { MenuEntry } from '@/components/app-context-menu';
import { allowedActions, getFocusedPane, updateLayout } from '@/dashboards/panes';
import { getEntry } from '@/data/data-store';
import { type PaneNode, setPaneWidget } from '@/panes/layout';
import { widgetMenuItems } from '@/panes/widget-menu';
import { widgetOptionsPane } from '@/panes/widget-options-handle';
import {
	type BindingSource,
	changeWidgetType,
	createWidget,
	resolveBindings,
	widgetBindings,
} from '@/widgets/bindings';
import { inferredOption, initialOptions, optionValues, pickedOption, setWidgetOption } from '@/widgets/options';
import { getWidgetType, widgetTypes } from '@/widgets/registry';
import { widgetTitle } from '@/widgets/widget-type';

export interface PaletteItem {
	id: string;
	label: string;
	icon: ComponentType<SVGProps<SVGSVGElement>>;
	/** What kind of thing it is, shown on the right instead of grouping the results */
	kind: 'Dashboard' | 'Page' | 'Widget' | 'Command' | 'Log';
	/** Shown after the label, ex. an option's value */
	detail?: string | undefined;
	keywords?: readonly string[] | undefined;
	shortcut?: Hotkey | undefined;
	/** Chosen, it lists these instead of running, ex. an option's choices */
	items?: () => PaletteItem[];
	/** What its items change, shown above them, ex. the widget an option is for. Its items' items keep it. */
	target?: { icon: ComponentType<SVGProps<SVGSVGElement>>; label: string } | undefined;
	/** The current choice among its page's items */
	checked?: boolean;
	run?: () => void;
	/** The items it's listed under when searching shows it outside of them, ex. `Orientation` for one of its choices */
	parent?: string | undefined;
	/** Matched ranges of its parent and label, see `HighlightedText` and `searchText()` */
	ranges?: number[] | undefined;
}

/** The commands that can run right now, pages first */
export function commandItems(router: RegisteredRouter): PaletteItem[] {
	return (
		Object.entries<AppCommand>(commands)
			// Undo and redo act on the focused text field, which would be the palette's search box
			.filter(([id, command]) => id !== 'commandPalette' && !command.ignoreInputs && canRunCommand(router, command))
			.toSorted(([, a], [, b]) => Number(b.page === true) - Number(a.page === true))
			.map(([id, command]) => ({
				id: `command:${id}`,
				label: command.label,
				icon: command.icon,
				kind: command.page ? 'Page' : 'Command',
				keywords: command.keywords,
				shortcut: command.shortcut,
				run: () => command.run(router),
			}))
	);
}

export function dashboardItems(router: RegisteredRouter, dashboards: readonly Dashboard[]): PaletteItem[] {
	return dashboards.map((dashboard, index) => ({
		id: `dashboard:${dashboard.id}`,
		label: dashboardName(dashboard),
		icon: LayoutDashboardIcon,
		kind: 'Dashboard',
		keywords: ['dashboard'],
		shortcut: dashboardShortcut(index),
		run: () => void router.navigate({ to: '/dashboards/$dashboardId', params: { dashboardId: dashboard.id } }),
	}));
}

export function recentLogItems(
	savedPaths: readonly string[],
	handles: ReturnType<typeof useRecentLogHandles>,
): PaletteItem[] {
	// Only the desktop app can open paths, ignore any saved on the web
	const paths = STUDIO_DESKTOP ? savedPaths : [];
	const labels = recentLogLabels(paths);
	return [
		...paths.map((path, index): PaletteItem => ({
			id: `recent:${path}`,
			label: labels[index]!,
			icon: FileIcon,
			kind: 'Log',
			keywords: [path],
			run: () => void openLogPath(path),
		})),
		...handles.map((recent): PaletteItem => ({
			id: `recent:${recent.id}`,
			label: recent.handle.name,
			icon: FileIcon,
			kind: 'Log',
			run: () => void openRecentLogHandle(recent.handle),
		})),
	];
}

/** The command palette's items for a widget's menu items, ex. a graph's Reset view */
function menuItems(
	entries: readonly MenuEntry[],
	id: string,
	detail: string,
	target: PaletteItem['target'],
): PaletteItem[] {
	return entries.flatMap((entry): PaletteItem[] => {
		if (entry === 'separator' || ('disabled' in entry && entry.disabled === true)) {
			return [];
		}
		const item = {
			id: `${id}:${entry.label}`,
			label: entry.label,
			icon: ZapIcon,
			kind: 'Widget',
			detail,
			target,
		} as const;
		if ('onSelect' in entry) {
			return [{ ...item, run: entry.onSelect }];
		}
		if ('items' in entry) {
			return [{ ...item, items: () => menuItems(entry.items, item.id, detail, target) }];
		}
		// Widgets don't add checkboxes or choices to their menus' actions
		return [];
	});
}

/**
 * The focused pane's widget's commands: adding or changing its widget, its options, and the actions it adds to its
 * menu. Options with their own controls are left to the widget options, which it can open.
 */
export function widgetItems(
	router: RegisteredRouter,
	sources: readonly BindingSource[],
	mobile: boolean,
): PaletteItem[] {
	const dashboard = paneCommandDashboard(router);
	if (!dashboard) {
		return [];
	}
	const pane = getFocusedPane(dashboard);
	const { widget } = pane;
	const type = widget && getWidgetType(widget.type);
	const update = (operation: (layout: PaneNode) => PaneNode) => updateLayout(dashboard.id, operation);
	const bindings = type ? resolveBindings(type, widgetBindings(widget), () => undefined, sources) : [];
	const values = type ? optionValues(type, widget, bindings, mobile) : {};
	const detail = type && widgetTitle(type, values);
	// Like the pane's title
	const target = { icon: type?.icon ?? LayoutDashboardIcon, label: detail ?? widget?.type ?? 'Empty pane' };
	const items: PaletteItem[] = [];

	if (allowedActions(dashboard.id, dashboard.layout, pane.id).changeWidget) {
		items.push({
			id: 'widget:change',
			label: widget === undefined ? 'Add widget' : 'Change widget',
			icon: ShapesIcon,
			kind: 'Widget',
			detail,
			target,
			items: () =>
				widgetTypes.map((other): PaletteItem => ({
					id: `widget:change:${other.id}`,
					label: other.name,
					icon: other.icon,
					kind: 'Widget',
					checked: other === type,
					run:
						other === type
							? undefined
							: () =>
									update((layout) =>
										widget === undefined
											? setPaneWidget(layout, pane.id, createWidget(other, undefined, initialOptions(other, layout)))
											: changeWidgetType(layout, pane.id, other, getEntry),
									),
				})),
		});
	}
	if (!type || detail === undefined) {
		return items;
	}

	if ((type.options?.length ?? 0) > 0) {
		items.push({
			id: 'widget:options',
			label: 'Widget options',
			icon: Settings2Icon,
			kind: 'Widget',
			detail,
			run: () => widgetOptionsPane.set(pane.id),
		});
	}
	for (const option of type.options ?? []) {
		// Text options and ones with a menu have their own controls in the widget options
		if (option.kind !== 'choice' || option.menu) {
			continue;
		}
		const choiceLabel = (id: string) => option.choices.find((choice) => choice.id === id)?.label ?? id;
		const inferred = inferredOption(option, bindings, values, mobile);
		const auto = inferred === undefined ? [] : [{ id: undefined, label: `Auto (${choiceLabel(inferred)})` }];
		const choices = [...auto, ...option.choices];
		// Like the widget options, Auto is picked until another choice is, or the default without Auto
		const current = pickedOption(widget, option) ?? (inferred === undefined ? option.default : undefined);
		items.push({
			id: `widget:option:${option.id}`,
			label: option.label,
			icon: Settings2Icon,
			kind: 'Widget',
			detail: choices.find((choice) => choice.id === current)?.label,
			target,
			items: () =>
				choices.map((choice) => ({
					id: `widget:option:${option.id}:${choice.id ?? ''}`,
					label: choice.label,
					// Choices have no icons of their own
					icon: Settings2Icon,
					kind: 'Widget',
					checked: choice.id === current,
					run: () => update((layout) => setWidgetOption(layout, pane.id, option.id, choice.id)),
				})),
		});
	}

	// Widgets add their menu items while they're shown in the pane
	const element = document.querySelector(`[data-pane-id="${CSS.escape(pane.id)}"]`);
	const { actions = [] } = element ? widgetMenuItems(pane.id, undefined, element, undefined) : {};
	items.push(...menuItems(actions, 'widget:action', detail, target));
	return items;
}
