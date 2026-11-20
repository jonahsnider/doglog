import type { HotkeyChord } from '@tanstack/react-hotkeys';
import type { ComponentType, SVGProps } from 'react';
import type { Entry } from '@/data/data-store';
import type { EntryKind } from '@/data/entry-kind';
import type { PaneNode } from '@/panes/layout';
import type { BindableKind, WidgetOptionInfo } from '@/widgets/widget-info';

/** A way a widget can show an entry, ex. the field draws a `Pose2d` as a robot or a ghost */
export type RoleOption = {
	/** Saved in dashboards, don't change it */
	readonly id: string;
	/** Shown in the legend's role picker, ex. `Ghost` */
	readonly label: string;
};

/** A bound entry as a widget shows it, see `resolveBindings()` */
export type WidgetBinding = {
	/** Tells apart bindings of the same entry, which can be bound more than once */
	readonly id: string;
	/** Bound entry name, ex. `/Arm/Angle` */
	readonly name: string;
	/** `undefined` when the active source has no entry with this name and an accepted kind. Show `<NoData />` for it. */
	readonly entry: Entry | undefined;
	/** Roles the entry can take in the widget, the inferred one first. Empty for widgets without roles. */
	readonly roles: readonly RoleOption[];
	/** The chosen or inferred role, `undefined` without an entry or for widgets without roles */
	readonly role: RoleOption | undefined;
	/** The role's label when it's worth showing: the entry has a choice of roles or is bound more than once */
	readonly roleLabel: string | undefined;
	/** Turned off from the legend, widgets with a legend list it but don't draw it */
	readonly hidden: boolean;
	/** Index of the color picked from the legend, widgets use it instead of their own, see `bindingColor()` */
	readonly color: number | undefined;
	/** How the binding can be connected to others, see `WidgetType.connects` */
	readonly connects: Connects | undefined;
	/** Bindings connected to this one, which the widget draws from, ex. the field draws lines from a robot to seen tags */
	readonly sources: readonly WidgetBinding[];
};

/**
 * A binding that shows one position, ex. a robot, can be connected to any connectable binding. One that shows `many`,
 * ex. a path, can only be connected to from a `single` one.
 */
export type Connects = 'single' | 'many';

/**
 * A setting shown in the widget options, saved in dashboards. Prefer inferring from entries over adding options, and
 * keep them few: they override what can be inferred, or pick what can't be (ex. which way the field faces).
 */
export type WidgetOption = WidgetOptionInfo & {
	/**
	 * Infers a choice from the bindings and the values of the options listed before it, which adds an Auto choice that's
	 * used until another one is picked. Returns `undefined` to use the default.
	 */
	readonly infer?: (bindings: readonly WidgetBinding[], earlier: OptionValues) => string | undefined;
	/** The choice a newly added widget starts with in `layout`, as if it was picked, ex. a controller not shown yet */
	readonly initial?: (layout: PaneNode) => string;
	/** Show fixed choices in a dropdown when they don't fit in a single segmented row. */
	readonly dropdown?: true;
	/**
	 * Lists the choices in a menu, with more from the user's own files and commands to change them, ex. the robot
	 * widget's robot projects. Use it with `openChoices`, so picked choices that aren't listed are kept, ex. a robot not
	 * added on this device, and the widget can say so.
	 */
	readonly menu?: OptionMenu;
};

export type OptionMenu = {
	/** Radio items for the choices listed after `choices`, which can change. Their labels are their IDs. */
	readonly Choices: ComponentType;
	/** Items for commands listed after the choices, which can pick a choice, `undefined` goes back to the default */
	readonly Commands: ComponentType<{ value: string; pick: (value: string | undefined) => void }>;
};

/** Option values by option ID, every option has one */
export type OptionValues = Readonly<Record<string, string>>;

export type WidgetProps = {
	/**
	 * Bound entries in the order they were bound. At least one of them has an entry, the widget isn't rendered otherwise,
	 * unless its type is `rendersEmpty`.
	 * Widgets are read-only, and follow the cursor with `useCursorTime()` or `subscribeTimeline()` from `@/timeline/timeline`.
	 */
	readonly bindings: readonly WidgetBinding[];
	/** The value of each of the type's `options` by option ID, always one of its choices' IDs */
	readonly options: OptionValues;
	/** Picks an option's value, ex. from a control in the widget. `undefined` goes back to Auto or the default. */
	readonly setOption: (id: string, value: string | undefined) => void;
};

export type WidgetType = {
	/** Saved in dashboards, don't change it */
	readonly id: string;
	/** Shown in the pane header and widget picker, ex. `Swerve` */
	readonly name: string;
	/** A Lucide icon, or a single color SVG imported with `?react` */
	readonly icon: ComponentType<SVGProps<SVGSVGElement>>;
	/** Picks this widget in a focused empty pane, or in the Change widget menu while it's open */
	readonly hotkey?: HotkeyChord;
	/** Kinds of entries that can be bound, none for widgets that don't show entries (ex. the notepad) */
	readonly accepts: readonly BindableKind[];
	/**
	 * Roles an accepted entry can take, the inferred one first. Narrows `accepts` too: entries with no roles aren't
	 * accepted. Widgets without roles show every entry the same way.
	 */
	readonly roles?: (entry: Entry) => readonly RoleOption[];
	/**
	 * Infers a binding's role from the bindings before it, ex. the field draws the first pose as a robot and later ones as
	 * ghosts. Without it, or when it returns `undefined`, a binding takes the first role no other binding of its entry has.
	 */
	readonly inferRole?: (
		roles: readonly RoleOption[],
		earlier: readonly WidgetBinding[],
		entry: Entry,
	) => RoleOption | undefined;
	/** How a binding can be connected to others from the legend, `undefined` for bindings that can't be connected */
	readonly connects?: (binding: WidgetBinding) => Connects | undefined;
	/** Rendered even with no entries or no data instead of the shared empty states, ex. the field shows the field */
	readonly rendersEmpty?: boolean;
	/** Entries bound to a newly added widget, ex. the console's `/console` and `/messages` */
	readonly defaultEntryNames?: readonly string[];
	/** Settings shown in the widget options, see `WidgetOption` */
	readonly options?: readonly WidgetOption[];
	/**
	 * Picks an option from an entry dropped on the widget instead of binding it, ex. the controller shows the dropped
	 * entry's controller. Entries it returns `undefined` for can't be dropped.
	 */
	readonly optionFromEntry?: (name: string) => { readonly id: string; readonly value: string } | undefined;
	/** Shown in the pane header and suggested dashboard names instead of `name`, ex. `Controller 2` */
	readonly title?: (options: OptionValues) => string;
	/** Loads a lazy renderer alongside the dashboard route, so the saved pane doesn't start out with a spinner. */
	readonly preload?: () => Promise<unknown>;
	readonly component: ComponentType<WidgetProps>;
};

/** The widget's name in its pane header and suggested dashboard names, see `WidgetType.title` */
export function widgetTitle(type: Pick<WidgetType, 'name' | 'title'>, options: OptionValues): string {
	return type.title?.(options) ?? type.name;
}

/** Whether entries can be bound to the widget at all */
export function bindsEntries(type: WidgetType): boolean {
	return type.accepts.length > 0;
}

export function acceptsEntry(type: WidgetType, entry: Entry): boolean {
	return (type.accepts as readonly EntryKind[]).includes(entry.kind) && (type.roles?.(entry).length ?? 1) > 0;
}

/**
 * Whether an entry can be dropped on the widget, to bind it or to pick an option from it (see `optionFromEntry`). Entries
 * missing from the source (`entry` is `undefined`) might be accepted once they're loaded.
 */
export function acceptsDrop(type: WidgetType, name: string, entry: Entry | undefined): boolean {
	if (type.optionFromEntry) {
		return type.optionFromEntry(name) !== undefined;
	}
	return entry === undefined || acceptsEntry(type, entry);
}
