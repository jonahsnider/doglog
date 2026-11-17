import type { HotkeyChord } from '@tanstack/react-hotkeys';
import type { LucideIcon } from 'lucide-react';
import type { ComponentType } from 'react';
import type { Entry } from '@/data/data-store';
import type { EntryKind } from '@/data/samples';

/** Entry kinds that can be bound to widgets */
export type BindableKind = Exclude<EntryKind, 'unsupported'>;

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
};

export type WidgetProps = {
	/**
	 * Bound entries in the order they were bound. At least one of them has an entry, the widget isn't rendered otherwise,
	 * unless its type is `rendersEmpty`.
	 * Widgets are read-only, and follow the cursor with `useCursorTime()` or `subscribeTimeline()` from `@/timeline`.
	 */
	readonly bindings: readonly WidgetBinding[];
};

export type WidgetType = {
	/** Saved in dashboards, don't change it */
	readonly id: string;
	/** Shown in the pane header and widget picker, ex. `Values table` */
	readonly name: string;
	readonly icon: LucideIcon;
	/** Picks this widget in a focused empty pane, or in the Change widget menu while it's open */
	readonly hotkey: HotkeyChord;
	/** Kinds of entries that can be bound, none for widgets that don't show entries (ex. the notepad) */
	readonly accepts: readonly BindableKind[];
	/**
	 * Roles an accepted entry can take, the inferred one first. Narrows `accepts` too: entries with no roles aren't
	 * accepted. Widgets without roles show every entry the same way.
	 */
	readonly roles?: (entry: Entry) => readonly RoleOption[];
	/** Rendered even with no entries or no data instead of the shared empty states, ex. the field shows the field */
	readonly rendersEmpty?: boolean;
	/** Entries bound to a newly added widget, ex. the console's `/console` and `/messages` */
	readonly defaultEntryNames?: readonly string[];
	readonly component: ComponentType<WidgetProps>;
};

export const bindableKinds: readonly BindableKind[] = [
	'number',
	'boolean',
	'string',
	'number[]',
	'boolean[]',
	'string[]',
	'struct',
	'struct[]',
];

/** Whether entries can be bound to the widget at all */
export function bindsEntries(type: WidgetType): boolean {
	return type.accepts.length > 0;
}

export function acceptsEntry(type: WidgetType, entry: Entry): boolean {
	return (type.accepts as readonly EntryKind[]).includes(entry.kind) && (type.roles?.(entry).length ?? 1) > 0;
}
