import { radiusVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import type { MenuEntry } from '@/components/app-context-menu';
import { updateLayout } from '@/dashboards/panes';
import { getSources, sourceList } from '@/data/source';
import { sourceLabels } from '@/sidebar/source-labels';
import { widgetDestinationItems } from '@/entries/entry-menu';
import type { Pane } from '@/panes/layout';
import { chartCount } from '@/theme/choices';
import { getRobotProjects } from '@/three/robot-projects';
import {
	bindingLabel,
	connectBindings,
	disconnectBindings,
	setBindingPick,
	setBindingRole,
	widgetBindings,
} from '@/widgets/bindings';
import { connectionBetween } from '@/widgets/legend/connections';
import { seriesColor } from '@/widgets/series-color';
import { pinName } from '@/widgets/source-entries';
import { widgetOptions } from '@/widgets/widget-info';
import type { WidgetBinding } from '@/widgets/widget-type';

const styles = stylex.create({
	swatch: {
		width: 12,
		height: 12,
		borderRadius: radiusVars['--radius-full'],
	},
	color: (color: string) => ({ backgroundColor: color }),
});

const roleMenuLabels: Partial<Record<string, string>> = {
	graph: 'Placement',
	robot: 'Mechanism plane',
	tuning: 'Layout',
};

const colorChoices = [
	{ value: 'auto', label: 'Auto' },
	...Array.from({ length: chartCount }, (_, index) => ({
		value: String(index),
		label: `Color ${index + 1}`,
		icon: <span aria-hidden {...stylex.props(styles.swatch, styles.color(seriesColor(index)))} />,
	})),
];

export function bindingMenuItems(
	dashboardId: string,
	pane: Pane,
	bindings: readonly WidgetBinding[],
	binding: WidgetBinding,
	target: Element,
): MenuEntry[] {
	const { id: paneId, widget } = pane;
	const { id, name } = binding;
	const legend = target.closest('[data-binding-legend]');
	const model = legend ? target.closest<HTMLElement>('[data-binding-id]')?.dataset['robotModel'] : undefined;
	const items: MenuEntry[] = [];
	const destinations = widgetDestinationItems(dashboardId, { name, paneId, bindingId: id });
	if (destinations.length > 0) {
		items.push({ label: 'Move to…', items: destinations });
	}

	if (binding.roles.length > 1) {
		items.push({
			label: roleMenuLabels[widget?.type ?? ''] ?? 'Show as',
			value: binding.role?.id ?? null,
			choices: binding.roles.map((role) => ({ value: role.id, label: role.label })),
			onValueChange: (role) => updateLayout(dashboardId, (layout) => setBindingRole(layout, paneId, id, role)),
		});
	}
	if (model !== undefined) {
		items.push({
			label: 'Robot model',
			value: model,
			choices: [
				...widgetOptions.robot.robot.choices.map((choice) => ({ value: choice.id, label: choice.label })),
				...getRobotProjects().map((project) => ({ value: project.name, label: project.name })),
			],
			onValueChange: (robot) =>
				updateLayout(dashboardId, (layout) => setBindingPick(layout, paneId, id, 'robot', robot)),
		});
	}
	if (target.closest('[data-pane-id]')?.querySelector(`[data-binding-id="${CSS.escape(id)}"] [data-binding-color]`)) {
		items.push({
			label: 'Color',
			value: binding.color === undefined ? 'auto' : String(binding.color),
			choices: colorChoices,
			onValueChange: (color) =>
				updateLayout(dashboardId, (layout) =>
					setBindingPick(layout, paneId, id, 'color', color === 'auto' ? undefined : Number(color)),
				),
		});
	}

	const sources = sourceList(getSources());
	if (sources.length > 1 || binding.pin !== undefined) {
		const choices = sources.map((source) => ({ value: pinName(source), label: sourceLabels(source).name }));
		if (binding.pin !== undefined && !choices.some((choice) => choice.value === binding.pin)) {
			choices.push({ value: binding.pin, label: binding.pin });
		}
		items.push({
			label: 'Source',
			value: binding.pin ?? 'all',
			choices: [{ value: 'all', label: 'All sources' }, ...choices],
			onValueChange: (pin) =>
				updateLayout(dashboardId, (layout) =>
					setBindingPick(layout, paneId, id, 'pin', pin === 'all' ? undefined : pin),
				),
		});
	}

	if (legend && binding.connects !== undefined) {
		const drawn = new Set(
			Array.from(legend.querySelectorAll<HTMLElement>('[data-binding-id]'), (row) => row.dataset['bindingId']),
		);
		const savedSources = new Map(widgetBindings(widget).map((saved) => [saved.id, new Set(saved.sources)]));
		const connect = bindings.flatMap((other) => {
			if (
				!drawn.has(other.id) ||
				savedSources.get(id)?.has(other.id) === true ||
				savedSources.get(other.id)?.has(id) === true
			) {
				return [];
			}
			const connection = connectionBetween(binding, other);
			return connection
				? [
						{
							label: bindingLabel(other),
							onSelect: () =>
								updateLayout(dashboardId, (layout) =>
									connectBindings(layout, paneId, connection.source.id, connection.target.id),
								),
						},
					]
				: [];
		});
		if (connect.length > 0) {
			items.push({ label: 'Connect to…', items: connect });
		}
	}
	const disconnect = bindings.flatMap((to) =>
		to.sources
			.filter((from) => from.id === id || to.id === id)
			.map((from) => ({
				label: `${bindingLabel(from)} → ${bindingLabel(to)}`,
				onSelect: () => updateLayout(dashboardId, (layout) => disconnectBindings(layout, paneId, from.id, to.id)),
			})),
	);
	if (disconnect.length > 0) {
		items.push({ label: 'Disconnect', items: disconnect });
	}
	return items;
}
