import * as z from 'zod';
import type { Entry } from '@/data/data-store';
import { createId } from '@/lib/random-id';
import { findPane, type PaneNode, setPaneWidget, type Widget } from '@/panes/layout';
import { initialOptions } from '@/widgets/options';
import { acceptsEntry, type RoleOption, type WidgetBinding, type WidgetType } from '@/widgets/widget-type';

export const bindingSchema = z.object({
	/** Tells apart bindings of the same entry, which can be bound more than once */
	id: z.string(),
	/** Entries are bound by name so dashboards work with any source */
	name: z.string(),
	/** A role the user picked, the widget infers one otherwise. Kept when it doesn't fit the entry, in case it fits again. */
	role: z.string().optional(),
	hidden: z.literal(true).optional(),
	/** Index of the color picked from the legend, the widget picks one otherwise, see `seriesColor()` */
	color: z.int().nonnegative().optional().catch(undefined),
	/** IDs of the bindings connected to this one from the legend, see `connectBindings()` */
	sources: z.array(z.string()).optional(),
});

export type Binding = z.infer<typeof bindingSchema>;

/** Validates a widget's saved config (`Widget.config`), invalid configs have no bound entries */
const configSchema = z.object({ bindings: z.array(bindingSchema).catch([]) }).catch({ bindings: [] });

function createBinding(name: string): Binding {
	return { id: createId(), name };
}

export function widgetBindings(widget: Widget | undefined): Binding[] {
	return configSchema.parse(widget?.config).bindings;
}

/** A new widget of a type, bound to `entryNames` or the type's default entries, with `options` picked */
export function createWidget(
	type: WidgetType,
	entryNames: readonly string[] = type.defaultEntryNames ?? [],
	options: Readonly<Record<string, string>> = {},
): Widget {
	const bindings = entryNames.map((name) => createBinding(name));
	return { type: type.id, config: Object.keys(options).length > 0 ? { bindings, options } : { bindings } };
}

function updateBindings(
	layout: PaneNode,
	paneId: string,
	update: (bindings: Binding[]) => readonly Binding[],
): PaneNode {
	const widget = findPane(layout, paneId)?.widget;
	if (widget === undefined) {
		return layout;
	}

	const config = typeof widget.config === 'object' ? widget.config : {};
	return setPaneWidget(layout, paneId, {
		...widget,
		config: { ...config, bindings: withoutStaleSources(update(widgetBindings(widget))) },
	});
}

/** Connections to bindings that were removed or moved to another widget are removed with them */
function withoutStaleSources(bindings: readonly Binding[]): Binding[] {
	const ids = new Set(bindings.map((binding) => binding.id));
	return bindings.map((binding) => {
		const { sources, ...rest } = binding;
		const kept = sources?.filter((id) => ids.has(id));
		return kept !== undefined && kept.length > 0 ? { ...rest, sources: kept } : rest;
	});
}

/**
 * Bind the entries a pane's widget doesn't show yet, ex. when an entry is added from the entry browser, where adding it
 * twice is more likely a double-click than on purpose. Returns `layout` itself when they're all bound already.
 */
export function addEntries(layout: PaneNode, paneId: string, names: readonly string[]): PaneNode {
	const bound = new Set(widgetBindings(findPane(layout, paneId)?.widget).map((binding) => binding.name));
	const added = [...new Set(names)].filter((name) => !bound.has(name));
	return added.length === 0
		? layout
		: updateBindings(layout, paneId, (bindings) => [...bindings, ...added.map((name) => createBinding(name))]);
}

/** Bind exactly these entries, like the entry picker's checkboxes: new ones go last, every binding of the others is removed */
export function setBoundEntries(layout: PaneNode, paneId: string, names: readonly string[]): PaneNode {
	const kept = new Set(names);
	return addEntries(
		updateBindings(layout, paneId, (bindings) => bindings.filter((binding) => kept.has(binding.name))),
		paneId,
		names,
	);
}

export function removeBinding(layout: PaneNode, paneId: string, bindingId: string): PaneNode {
	return updateBindings(layout, paneId, (bindings) => bindings.filter((binding) => binding.id !== bindingId));
}

/** Bind `binding` again where it was in `previous`, an earlier copy of the pane's bindings, ex. to undo removing it */
export function restoreBinding(
	layout: PaneNode,
	paneId: string,
	binding: Binding,
	previous: readonly Binding[],
): PaneNode {
	const position = (id: string) => previous.findIndex((other) => other.id === id);
	return updateBindings(layout, paneId, (bindings) => {
		const next = bindings.findIndex((other) => position(other.id) > position(binding.id));
		return next === -1 ? [...bindings, binding] : bindings.toSpliced(next, 0, binding);
	});
}

export function setBindingRole(layout: PaneNode, paneId: string, bindingId: string, role: string): PaneNode {
	return updateBindings(layout, paneId, (bindings) =>
		bindings.map((binding) => (binding.id === bindingId ? { ...binding, role } : binding)),
	);
}

/** Pick a series color for a binding, `undefined` lets the widget pick one again */
export function setBindingColor(
	layout: PaneNode,
	paneId: string,
	bindingId: string,
	color: number | undefined,
): PaneNode {
	return updateBindings(layout, paneId, (bindings) =>
		bindings.map((binding) => {
			if (binding.id !== bindingId) {
				return binding;
			}
			const { color: _, ...rest } = binding;
			return color === undefined ? rest : { ...rest, color };
		}),
	);
}

/** Connect `sourceId` to `targetId`, unless they're the same binding or already connected either way */
export function connectBindings(layout: PaneNode, paneId: string, sourceId: string, targetId: string): PaneNode {
	const bindings = widgetBindings(findPane(layout, paneId)?.widget);
	const connected = (from: string, to: string) =>
		bindings.find((binding) => binding.id === to)?.sources?.includes(from) === true;
	if (sourceId === targetId || connected(sourceId, targetId) || connected(targetId, sourceId)) {
		return layout;
	}
	return updateBindings(layout, paneId, (current) =>
		current.map((binding) =>
			binding.id === targetId ? { ...binding, sources: [...(binding.sources ?? []), sourceId] } : binding,
		),
	);
}

export function disconnectBindings(layout: PaneNode, paneId: string, sourceId: string, targetId: string): PaneNode {
	return updateBindings(layout, paneId, (bindings) =>
		bindings.map((binding) =>
			binding.id === targetId ? { ...binding, sources: binding.sources?.filter((id) => id !== sourceId) } : binding,
		),
	);
}

/** Copies of an entry are told apart by their roles, ex. `/Drive/Pose (Ghost)` */
export function bindingLabel({ name, roleLabel }: WidgetBinding): string {
	return roleLabel === undefined ? name : `${name} (${roleLabel})`;
}

export function toggleBindingHidden(layout: PaneNode, paneId: string, bindingId: string): PaneNode {
	return updateBindings(layout, paneId, (bindings) =>
		bindings.map((binding) => {
			if (binding.id !== bindingId) {
				return binding;
			}
			const { hidden, ...shown } = binding;
			return hidden ? shown : { ...binding, hidden: true };
		}),
	);
}

/** Where a dragged entry is dropped: a pane's widget, optionally onto one of its bindings to take that binding's position */
export type EntryDrop = {
	paneId: string;
	index?: number;
	/** The role the entry takes, ex. when it's dropped on a graph's right axis */
	role?: string;
};

/** A dragged entry, `from` is the binding it was dragged out of when it's from a widget */
/** `field` is the only field of the struct `name`, bound instead when the widget can't show the struct */
export type DraggedEntry = { name: string; field?: string | undefined; from?: { paneId: string; bindingId: string } };

/**
 * Bind a dropped entry to a pane's widget, at `to.index` or after its other bindings, even if the widget already shows it.
 * A binding dropped in its own pane is reordered, and one from another pane is moved out of it with its role.
 */
export function dropEntry(layout: PaneNode, dragged: DraggedEntry, to: EntryDrop): PaneNode {
	const { from } = dragged;
	const binding =
		(from && widgetBindings(findPane(layout, from.paneId)?.widget).find((other) => other.id === from.bindingId)) ??
		createBinding(dragged.name);
	const placed = to.role === undefined ? binding : { ...binding, role: to.role };
	const dropped = updateBindings(layout, to.paneId, (bindings) => {
		const others = bindings.filter((other) => other.id !== binding.id);
		return others.toSpliced(to.index ?? others.length, 0, placed);
	});
	return dropped === layout || from === undefined || from.paneId === to.paneId
		? dropped
		: removeBinding(dropped, from.paneId, binding.id);
}

/**
 * Show another widget type in a pane, keeping the bindings it accepts with their roles. Entries missing from the source
 * might be accepted once they're loaded, so only known mismatches are unbound. Uses the type's default entries if none are kept.
 */
export function changeWidgetType(
	layout: PaneNode,
	paneId: string,
	type: WidgetType,
	entryOf: (name: string) => Entry | undefined,
): PaneNode {
	const kept = widgetBindings(findPane(layout, paneId)?.widget).filter(({ name }) => {
		const entry = entryOf(name);
		return entry === undefined || acceptsEntry(type, entry);
	});
	return setPaneWidget(
		layout,
		paneId,
		kept.length > 0
			? { type: type.id, config: { bindings: kept } }
			: createWidget(type, undefined, initialOptions(type, layout)),
	);
}

/**
 * Bindings as the widget shows them, with their entries, roles, and connections. A binding without a picked role (or
 * with one that doesn't fit) takes the role the widget infers from the bindings before it, or the first role no other
 * binding of its entry has, so a second binding of a robot's pose isn't drawn on top of it. Hidden bindings count too,
 * so hiding one doesn't change the others' roles. Connections that don't fit the bindings' roles are kept but not used.
 */
export function resolveBindings(
	type: WidgetType,
	bindings: readonly Binding[],
	entryOf: (name: string) => Entry | undefined,
): WidgetBinding[] {
	const resolved = bindings.map((binding) => {
		const found = entryOf(binding.name);
		const entry = found && acceptsEntry(type, found) ? found : undefined;
		const roles = entry && type.roles ? type.roles(entry) : [];
		return { binding, entry, roles, picked: roles.find((role) => role.id === binding.role) };
	});

	const counts = new Map<string, number>();
	/** Roles each entry's bindings have, picked ones first */
	const taken = new Map<string, Set<string>>();
	for (const { binding, picked } of resolved) {
		counts.set(binding.name, (counts.get(binding.name) ?? 0) + 1);
		const roles = taken.get(binding.name) ?? new Set();
		taken.set(binding.name, roles);
		if (picked) {
			roles.add(picked.id);
		}
	}

	// Connections are added once every binding has its role, since what can be connected depends on it
	const withRoles: Mutable<WidgetBinding>[] = [];
	for (const { binding, entry, roles, picked } of resolved) {
		let role: RoleOption | undefined =
			picked ?? (entry && roles.length > 0 ? type.inferRole?.(roles, withRoles, entry) : undefined);
		const others = taken.get(binding.name)!;
		if (role === undefined && roles.length > 0) {
			role = roles.find((option) => !others.has(option.id)) ?? roles[0]!;
		}
		if (role !== undefined) {
			others.add(role.id);
		}
		const withRole = {
			id: binding.id,
			name: binding.name,
			entry,
			roles,
			role,
			roleLabel: role && (roles.length > 1 || counts.get(binding.name)! > 1) ? role.label : undefined,
			hidden: binding.hidden === true,
			color: binding.color,
			connects: undefined,
			sources: [],
		};
		withRoles.push({ ...withRole, connects: entry ? type.connects?.(withRole) : undefined });
	}

	const byId = new Map(withRoles.map((binding) => [binding.id, binding]));
	for (const [index, binding] of withRoles.entries()) {
		binding.sources =
			binding.connects === undefined
				? []
				: (bindings[index]!.sources ?? []).flatMap((id) => {
						const source = byId.get(id);
						return source?.connects === 'single' ? [source] : [];
					});
	}
	return withRoles;
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
