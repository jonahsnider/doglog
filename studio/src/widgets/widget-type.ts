import type { Hotkey } from '@tanstack/react-hotkeys';
import type { LucideIcon } from 'lucide-react';
import type { ComponentType } from 'react';
import * as z from 'zod';
import type { Entry } from '@/data/data-store';
import type { EntryKind } from '@/data/samples';

/** Entry kinds that can be bound to widgets */
export type BindableKind = Exclude<EntryKind, 'unsupported'>;

/** Validates a widget's saved config (`Widget.config`), invalid configs have no bound entries */
export const widgetConfigSchema = z
	.object({
		/** Entries are bound by name so dashboards work with any source */
		entryNames: z.array(z.string()).catch([]),
	})
	.catch({ entryNames: [] });

type WidgetConfig = z.infer<typeof widgetConfigSchema>;

export type WidgetBinding = {
	/** Bound entry name, ex. `/Arm/Angle` */
	readonly name: string;
	/** `undefined` when the active source has no entry with this name and an accepted kind. Show `<NoData />` for it. */
	readonly entry: Entry | undefined;
};

export type WidgetProps = {
	/**
	 * Bound entries in the order they were bound. At least one of them has an entry, the widget isn't rendered otherwise.
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
	readonly hotkey: Hotkey;
	/** Kinds of entries that can be bound */
	readonly accepts: readonly BindableKind[];
	/** Narrows `accepts` further, ex. to specific struct types */
	readonly matches?: (entry: Entry) => boolean;
	/** Config of a newly added widget, ex. default bindings */
	readonly defaultConfig: WidgetConfig;
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

export function acceptsEntry(type: WidgetType, entry: Entry): boolean {
	return (type.accepts as readonly EntryKind[]).includes(entry.kind) && (type.matches?.(entry) ?? true);
}
