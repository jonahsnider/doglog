// Turns agents' layout and widget input into dashboard layouts, and dashboards into what agents read, checking both
// the way the user's edits are limited
import { AgentError } from '@/agent/agent-error';
import type { LayoutInput, WidgetInput } from '@/agent/schemas';
import type { Entry } from '@/data/data-store';
import { createId } from '@/lib/random-id';
import {
	type Binding,
	connectBindings,
	createWidget,
	resolveBindings,
	setBindingPick,
	setBindingRole,
	toggleBindingHidden,
	widgetBindings,
} from '@/widgets/bindings';
import { initialOptions, optionValues } from '@/widgets/options';
import { getWidgetType } from '@/widgets/registry';
import { widgetInfos } from '@/widgets/widget-info';
import { acceptsEntry, bindsEntries, canConnect, type WidgetType } from '@/widgets/widget-type';
import {
	createPane,
	findPane,
	maxPanesAlong,
	panesAlong,
	type PaneNode,
	setPaneWidget,
	type SplitDirection,
	type Widget,
} from '@/panes/layout';
import { childSizes, normalize } from '@/panes/split-sizes';

type EntryOf = (name: string) => Entry | undefined;

const directionNames: Record<SplitDirection, string> = { row: 'side by side', column: 'stacked' };

export function tooManyPanes(direction: SplitDirection): AgentError {
	return new AgentError(`At most ${maxPanesAlong} panes fit ${directionNames[direction]}.`);
}

/** Rejects layouts with more panes in a row or column than fit, like the user can't split panes further */
function checkPanesFit(layout: PaneNode): void {
	for (const direction of ['row', 'column'] as const) {
		if (panesAlong(layout, direction) > maxPanesAlong) {
			throw tooManyPanes(direction);
		}
	}
}

/**
 * Checks that a widget can show an entry in a role, as the user could bind it. Entries missing from the source can be
 * bound with any of the widget's roles, in case they're loaded later.
 */
export function checkBinding(type: WidgetType, name: string, role: string | undefined, entryOf: EntryOf): void {
	if (!bindsEntries(type)) {
		throw new AgentError(
			type.optionFromEntry
				? `${type.name} widgets don't show entries, pick what they show with their options instead.`
				: `${type.name} widgets don't show entries.`,
		);
	}
	const entry = entryOf(name);
	if (entry && !acceptsEntry(type, entry)) {
		throw new AgentError(
			`${type.name} widgets can't show \`${name}\` (${entry.type}). See \`dashboard_create\` for what they accept.`,
		);
	}
	if (role === undefined) {
		return;
	}
	const roles: readonly string[] =
		widgetInfos.find((info) => info.id === type.id)?.roles.map((option) => option.id) ?? [];
	if (!roles.includes(role)) {
		throw new AgentError(
			roles.length === 0
				? `${type.name} widgets don't have roles.`
				: `\`${role}\` isn't a role of ${type.name} widgets, which has \`${roles.join('`, `')}\`.`,
		);
	}
	const fits = entry && type.roles ? type.roles(entry).map((option) => option.id) : roles;
	if (!fits.includes(role)) {
		throw new AgentError(`\`${name}\` (${entry?.type}) can't be \`${role}\`, it can be \`${fits.join('`, `')}\`.`);
	}
}

/** Checks that every connection between bindings is one the user could make, when both bindings' entries are known */
export function checkConnections(type: WidgetType, bindings: readonly Binding[], entryOf: EntryOf): void {
	const resolved = resolveBindings(type, bindings, entryOf);
	const byId = new Map(resolved.map((binding) => [binding.id, binding]));
	for (const [index, target] of resolved.entries()) {
		for (const sourceId of bindings[index]!.sources ?? []) {
			const source = byId.get(sourceId);
			if (!source || source.id === target.id) {
				throw new AgentError('A binding can only be connected to another binding in the same widget.');
			}
			if (source.entry && target.entry && (!canConnect(source, target) || source.sources.includes(target))) {
				throw new AgentError(
					`\`${target.name}\` can't be connected from \`${source.name}\`. Lines are drawn from a single robot, ghost, or point to another robot, ghost, point, points, or path, one way, and parts and mechanisms are attached to a robot or ghost.`,
				);
			}
		}
	}
}

export function applyBindingInput(
	layout: PaneNode,
	paneId: string,
	binding: Binding,
	{
		role,
		color,
		hidden,
		robot,
	}: {
		role?: string | undefined;
		color?: number | null | undefined;
		hidden?: boolean | undefined;
		robot?: string | null | undefined;
	},
): PaneNode {
	let next = layout;
	if (role !== undefined) {
		next = setBindingRole(next, paneId, binding.id, role);
	}
	if (color !== undefined) {
		next = setBindingPick(next, paneId, binding.id, 'color', color ?? undefined);
	}
	if (robot !== undefined) {
		next = setBindingPick(next, paneId, binding.id, 'robot', robot ?? undefined);
	}
	if (hidden !== undefined && hidden !== (binding.hidden === true)) {
		next = toggleBindingHidden(next, paneId, binding.id);
	}
	return next;
}

/** Option picks from agent input, `null` goes back to inferring the option or its default */
function optionPicks(
	type: WidgetType,
	layout: PaneNode,
	options: Readonly<Record<string, string | null | undefined>> | undefined,
): Record<string, string> {
	const picks: Record<string, string> = initialOptions(type, layout);
	for (const [id, value] of Object.entries(options ?? {})) {
		if (value === null) {
			delete picks[id];
		} else if (value !== undefined) {
			picks[id] = value;
		}
	}
	return picks;
}

export function showInputWidget(layout: PaneNode, paneId: string, input: WidgetInput, entryOf: EntryOf): PaneNode {
	const type = getWidgetType(input.type)!;
	const { bindings } = input;
	for (const binding of bindings ?? []) {
		checkBinding(type, binding.entry, binding.role, entryOf);
	}

	const widget = createWidget(
		type,
		bindings?.map((binding) => binding.entry),
		optionPicks(type, layout, input.options),
	);
	let next = setPaneWidget(layout, paneId, widget);
	const created = widgetBindings(widget);
	for (const [index, binding] of (bindings ?? []).entries()) {
		const target = created[index]!;
		next = applyBindingInput(next, paneId, target, binding);
		for (const sourceIndex of binding.connectedFrom ?? []) {
			const source = created[sourceIndex];
			if (!source || sourceIndex === index) {
				throw new AgentError(
					`Binding ${index} can't be connected from binding ${sourceIndex}, there's no other binding there.`,
				);
			}
			next = connectBindings(next, paneId, source.id, target.id);
		}
	}
	checkConnections(type, widgetBindings(findPane(next, paneId)?.widget), entryOf);
	return next;
}

/** A layout from agent input, with new IDs. Throws an `AgentError` if the user couldn't make it. */
export function createInputLayout(input: LayoutInput, entryOf: EntryOf): PaneNode {
	const widgets: { paneId: string; widget: WidgetInput }[] = [];
	const build = (node: LayoutInput): PaneNode => {
		if (node.kind === 'pane') {
			const pane = { ...createPane(), size: node.size };
			if (node.widget) {
				widgets.push({ paneId: pane.id, widget: node.widget });
			}
			return pane;
		}
		return {
			kind: 'split',
			id: createId(),
			direction: node.direction,
			size: node.size,
			children: node.children.map((child) => build(child)),
		};
	};

	let layout = normalize({ ...build(input), size: undefined });
	checkPanesFit(layout);
	// One at a time, so widgets start like they would added one after another, ex. controllers show different ports
	for (const { paneId, widget } of widgets) {
		layout = showInputWidget(layout, paneId, widget, entryOf);
	}
	return layout;
}

/** How a binding shows in `dashboard_get` */
function describeBindings(type: WidgetType, widget: Widget, entryOf: EntryOf, sourceOpen: boolean) {
	const bindings = widgetBindings(widget);
	const resolved = resolveBindings(type, bindings, entryOf);
	return resolved.map((binding, index) => {
		const { role, sources } = bindings[index]!;
		const entry = entryOf(binding.name);
		const problems: string[] = [];
		if (sourceOpen && entry === undefined) {
			problems.push("The entry isn't in the active source.");
		} else if (entry && binding.entry === undefined) {
			problems.push(`${type.name} widgets can't show ${entry.type} entries.`);
		} else if (binding.entry && role !== undefined && binding.role?.id !== role) {
			problems.push(`\`${role}\` doesn't fit ${binding.entry.type} entries, so it's shown as \`${binding.role?.id}\`.`);
		}
		const unused = (sources ?? []).filter((id) => !binding.sources.some((source) => source.id === id));
		if (binding.entry && unused.length > 0) {
			problems.push(`Lines from ${unused.join(', ')} aren't drawn, they aren't a single robot, ghost, or point.`);
		}
		return {
			id: binding.id,
			entry: binding.name,
			// The picked role is kept without an entry to infer one from
			role: binding.role?.id ?? role,
			color: binding.color,
			hidden: binding.hidden ? true : undefined,
			robot: binding.robot,
			connectedFrom: sources,
			problems: problems.length > 0 ? problems : undefined,
		};
	});
}

function describeWidget(widget: Widget, entryOf: EntryOf, sourceOpen: boolean) {
	const type = getWidgetType(widget.type);
	if (!type) {
		return { type: widget.type, problems: ['Unknown widget type, it may be from a newer version of Studio.'] };
	}
	const bindings = describeBindings(type, widget, entryOf, sourceOpen);
	const options = optionValues(type, widget, resolveBindings(type, widgetBindings(widget), entryOf));
	return {
		type: type.id,
		options: Object.keys(options).length > 0 ? options : undefined,
		bindings: bindsEntries(type) ? bindings : undefined,
		problems: bindsEntries(type) && bindings.length === 0 ? ['No entries are bound.'] : undefined,
	};
}

type DescribedNode =
	| { kind: 'pane'; id: string; size?: number; widget: ReturnType<typeof describeWidget> | null }
	| { kind: 'split'; id: string; size?: number; direction: SplitDirection; children: DescribedNode[] };

/** A layout as `dashboard_get` shows it, with each node's share of its parent split, rounded to keep it readable */
export function describeLayout(node: PaneNode, entryOf: EntryOf, sourceOpen: boolean, size?: number): DescribedNode {
	if (node.kind === 'pane') {
		const widget = node.widget ? describeWidget(node.widget, entryOf, sourceOpen) : null;
		return { kind: 'pane', id: node.id, size, widget };
	}
	const sizes = childSizes(node);
	return {
		kind: 'split',
		id: node.id,
		size,
		direction: node.direction,
		children: node.children.map((child, index) =>
			describeLayout(child, entryOf, sourceOpen, Math.round((sizes[index] ?? 0) * 1000) / 1000),
		),
	};
}
