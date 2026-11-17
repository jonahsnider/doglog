// The entries bound to a pane's widget. Every change to them goes through here.
import * as z from 'zod';
import type { Entry } from '@/data/data-store';
import { findPane, type PaneNode, setPaneWidget, type Widget } from '@/pane-layout';
import { acceptsEntry, type RoleOption, type WidgetBinding, type WidgetType } from '@/widgets/widget-type';

const bindingSchema = z.object({
	/** Tells apart bindings of the same entry, which can be bound more than once */
	id: z.string(),
	/** Entries are bound by name so dashboards work with any source */
	name: z.string(),
	/** A role the user picked, the widget infers one otherwise. Kept when it doesn't fit the entry, in case it fits again. */
	role: z.string().optional(),
	hidden: z.literal(true).optional(),
});

export type Binding = z.infer<typeof bindingSchema>;

/** Validates a widget's saved config (`Widget.config`), invalid configs have no bound entries */
const configSchema = z.object({ bindings: z.array(bindingSchema).catch([]) }).catch({ bindings: [] });

function createBinding(name: string): Binding {
	return { id: crypto.randomUUID(), name };
}

export function widgetBindings(widget: Widget | undefined): Binding[] {
	return configSchema.parse(widget?.config).bindings;
}

/** A new widget of a type, bound to `entryNames` or the type's default entries */
export function createWidget(type: WidgetType, entryNames: readonly string[] = type.defaultEntryNames ?? []): Widget {
	return { type: type.id, config: { bindings: entryNames.map((name) => createBinding(name)) } };
}

/** Change a pane's bindings, keeping its widget's other config fields */
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
	return setPaneWidget(layout, paneId, { ...widget, config: { ...config, bindings: update(widgetBindings(widget)) } });
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

export function setBindingRole(layout: PaneNode, paneId: string, bindingId: string, role: string): PaneNode {
	return updateBindings(layout, paneId, (bindings) =>
		bindings.map((binding) => (binding.id === bindingId ? { ...binding, role } : binding)),
	);
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
export type EntryDrop = { paneId: string; index?: number };

/** A dragged entry, `from` is the binding it was dragged out of when it's from a widget */
export type DraggedEntry = { name: string; from?: { paneId: string; bindingId: string } };

/**
 * Bind a dropped entry to a pane's widget, at `to.index` or after its other bindings, even if the widget already shows it.
 * A binding dropped in its own pane is reordered, and one from another pane is moved out of it with its role.
 */
export function dropEntry(layout: PaneNode, dragged: DraggedEntry, to: EntryDrop): PaneNode {
	const { from } = dragged;
	const binding =
		(from && widgetBindings(findPane(layout, from.paneId)?.widget).find((other) => other.id === from.bindingId)) ??
		createBinding(dragged.name);
	const dropped = updateBindings(layout, to.paneId, (bindings) => {
		const others = bindings.filter((other) => other.id !== binding.id);
		return others.toSpliced(to.index ?? others.length, 0, binding);
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
		kept.length > 0 ? { type: type.id, config: { bindings: kept } } : createWidget(type),
	);
}

/**
 * Bindings as the widget shows them, with their entries and roles. A binding without a picked role (or with one that
 * doesn't fit) takes the first role no other binding of its entry has, so a second binding of a robot's pose is a ghost
 * instead of a robot drawn on top of it. Hidden bindings count too, so hiding one doesn't change the others' roles.
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

	return resolved.map(({ binding, entry, roles, picked }) => {
		let role: RoleOption | undefined = picked;
		if (role === undefined && roles.length > 0) {
			const others = taken.get(binding.name)!;
			role = roles.find((option) => !others.has(option.id)) ?? roles[0]!;
			others.add(role.id);
		}
		return {
			id: binding.id,
			name: binding.name,
			entry,
			roles,
			role,
			roleLabel: role && (roles.length > 1 || counts.get(binding.name)! > 1) ? role.label : undefined,
			hidden: binding.hidden === true,
		};
	});
}
