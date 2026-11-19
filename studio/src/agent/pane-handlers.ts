// Agent commands for panes and bindings, through the same functions the user's edits use, so they're undoable, saved,
// and shared
import { AgentError } from '@/agent/agent-error';
import type { Handlers } from '@/agent/commands';
import { describeDashboard, requireDashboard } from '@/agent/dashboard-handlers';
import { applyBindingInput, checkBinding, checkConnections, showInputWidget, tooManyPanes } from '@/agent/layouts';
import { updateDashboard } from '@/dashboards/dashboards';
import { closeDashboardPane, moveDashboardPane, splitDirectionFor, updateLayout } from '@/dashboards/panes';
import { flushData, getEntry } from '@/data/data-store';
import {
	canMovePane,
	canSplitPane,
	createPane,
	findPane,
	findParent,
	type Pane,
	type PaneNode,
	panes,
	resizeSplit,
	setPaneWidget,
	type SplitDirection,
	splitPane,
} from '@/panes/layout';
import { childSizes } from '@/panes/split-sizes';
import {
	changeWidgetType,
	connectBindings,
	createWidget,
	disconnectBindings,
	dropEntry,
	removeBinding,
	widgetBindings,
} from '@/widgets/bindings';
import { initialOptions, setWidgetOption } from '@/widgets/options';
import { getWidgetType } from '@/widgets/registry';
import type { WidgetType } from '@/widgets/widget-type';

function requirePane(layout: PaneNode, paneId: string): Pane {
	const pane = findPane(layout, paneId);
	if (!pane) {
		throw new AgentError(`The dashboard has no pane \`${paneId}\`, see \`dashboard_get\`.`);
	}
	return pane;
}

function requireWidgetType(pane: Pane): WidgetType {
	const type = pane.widget && getWidgetType(pane.widget.type);
	if (!type) {
		throw new AgentError('The pane has no widget, show one with `pane_update` first.');
	}
	return type;
}

function requireBinding(layout: PaneNode, bindingId: string) {
	for (const pane of panes(layout)) {
		const binding = widgetBindings(pane.widget).find((other) => other.id === bindingId);
		if (binding) {
			return { pane, binding, type: requireWidgetType(pane) };
		}
	}
	throw new AgentError(`The dashboard has no binding \`${bindingId}\`, see \`dashboard_get\`.`);
}

/** The direction Studio splits a pane in when the user adds a widget to it, see `addDashboardWidget()` */
function addDirection(layout: PaneNode, paneId: string): SplitDirection {
	const preferred = splitDirectionFor(paneId);
	const other: SplitDirection = preferred === 'row' ? 'column' : 'row';
	const direction = [preferred, other].find((option) => canSplitPane(layout, paneId, option));
	if (direction === undefined) {
		throw tooManyPanes(preferred);
	}
	return direction;
}

/** Give a pane `size` of its split, the others keep their shares of the rest */
function resizePane(layout: PaneNode, paneId: string, size: number): PaneNode {
	const parent = findParent(layout, paneId);
	if (!parent) {
		throw new AgentError('The only pane fills the dashboard, so it can’t be resized.');
	}
	const sizes = childSizes(parent);
	const index = parent.children.findIndex((child) => child.id === paneId);
	const rest = 1 - sizes[index]!;
	return resizeSplit(
		layout,
		parent.id,
		sizes.map((other, otherIndex) => (otherIndex === index ? size : (other / rest) * (1 - size))),
	);
}

export const paneHandlers: Pick<
	Handlers,
	'pane_create' | 'pane_update' | 'pane_move' | 'pane_delete' | 'binding_create' | 'binding_update' | 'binding_delete'
> = {
	pane_create: ({ dashboardId, paneId, direction, widget }) => {
		requireDashboard(dashboardId);
		flushData();
		const newPane = createPane();
		updateDashboard(dashboardId, (dashboard) => {
			const { layout } = dashboard;
			requirePane(layout, paneId);
			const split = direction ?? addDirection(layout, paneId);
			if (!canSplitPane(layout, paneId, split)) {
				throw tooManyPanes(split);
			}
			const added = splitPane(layout, paneId, split, newPane);
			return {
				...dashboard,
				layout: widget ? showInputWidget(added, newPane.id, widget, getEntry) : added,
				focusedPaneId: newPane.id,
			};
		});
		return { paneId: newPane.id, dashboard: describeDashboard(dashboardId) };
	},

	pane_update: ({ dashboardId, paneId, widget, size }) => {
		requireDashboard(dashboardId);
		flushData();
		updateLayout(dashboardId, (layout) => {
			const pane = requirePane(layout, paneId);
			let next = layout;
			if (widget === null) {
				next = setPaneWidget(next, paneId, undefined);
			} else if (widget !== undefined) {
				const type = getWidgetType(widget.type)!;
				if (pane.widget === undefined) {
					next = setPaneWidget(next, paneId, createWidget(type, undefined, initialOptions(type, next)));
				} else if (pane.widget.type !== type.id) {
					next = changeWidgetType(next, paneId, type, getEntry);
				}
				for (const [id, value] of Object.entries(widget.options ?? {})) {
					next = setWidgetOption(next, paneId, id, value ?? undefined);
				}
			}
			return size === undefined ? next : resizePane(next, paneId, size);
		});
		return describeDashboard(dashboardId);
	},

	pane_move: ({ dashboardId, paneId, targetPaneId, side }) => {
		const { layout } = requireDashboard(dashboardId);
		requirePane(layout, paneId);
		requirePane(layout, targetPaneId);
		if (paneId === targetPaneId) {
			throw new AgentError('A pane can’t be moved beside itself.');
		}
		if (!canMovePane(layout, paneId, targetPaneId, side)) {
			throw tooManyPanes(side === 'left' || side === 'right' ? 'row' : 'column');
		}
		moveDashboardPane(dashboardId, paneId, targetPaneId, side);
		return describeDashboard(dashboardId);
	},

	pane_delete: ({ dashboardId, paneId }) => {
		requirePane(requireDashboard(dashboardId).layout, paneId);
		closeDashboardPane(dashboardId, paneId);
		return describeDashboard(dashboardId);
	},

	binding_create: ({ dashboardId, paneId, bindings }) => {
		requireDashboard(dashboardId);
		flushData();
		const bindingIds: string[] = [];
		updateLayout(dashboardId, (layout) => {
			const type = requireWidgetType(requirePane(layout, paneId));
			for (const { entry, role } of bindings) {
				checkBinding(type, entry, role, getEntry);
			}
			let next = layout;
			for (const input of bindings) {
				// Like the user dropping the entry on the widget, which adds it last
				next = dropEntry(next, { name: input.entry }, { paneId });
				const binding = widgetBindings(findPane(next, paneId)?.widget).at(-1)!;
				next = applyBindingInput(next, paneId, binding, input);
				bindingIds.push(binding.id);
			}
			return next;
		});
		return { bindingIds, dashboard: describeDashboard(dashboardId) };
	},

	binding_update: ({ dashboardId, bindingId, role, color, hidden, connectedFrom }) => {
		requireDashboard(dashboardId);
		flushData();
		updateLayout(dashboardId, (layout) => {
			const { pane, binding, type } = requireBinding(layout, bindingId);
			checkBinding(type, binding.name, role, getEntry);
			let next = applyBindingInput(layout, pane.id, binding, { role, color, hidden });
			if (connectedFrom !== undefined) {
				if (!type.connects) {
					throw new AgentError(`${type.name} widgets don’t connect bindings.`);
				}
				const current = new Set(binding.sources);
				const wanted = new Set(connectedFrom);
				for (const sourceId of [...current].filter((id) => !wanted.has(id))) {
					next = disconnectBindings(next, pane.id, sourceId, bindingId);
				}
				for (const sourceId of [...wanted].filter((id) => !current.has(id))) {
					next = connectBindings(next, pane.id, sourceId, bindingId);
				}
				// Bindings can't be connected to themselves, or both ways
				const connected = new Set(requireBinding(next, bindingId).binding.sources);
				const skipped = [...wanted].filter((id) => !connected.has(id));
				if (skipped.length > 0) {
					throw new AgentError(
						`\`${skipped.join('`, `')}\` can’t be connected, since this binding is connected from it.`,
					);
				}
				checkConnections(type, widgetBindings(findPane(next, pane.id)?.widget), getEntry);
			}
			return next;
		});
		return describeDashboard(dashboardId);
	},

	binding_delete: ({ dashboardId, bindingId }) => {
		requireDashboard(dashboardId);
		updateLayout(dashboardId, (layout) => removeBinding(layout, requireBinding(layout, bindingId).pane.id, bindingId));
		return describeDashboard(dashboardId);
	},
};
