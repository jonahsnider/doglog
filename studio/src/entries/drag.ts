import { type Draggable, PointerActivationConstraints } from '@dnd-kit/dom';
import { PointerSensor, useDraggable, useDroppable } from '@dnd-kit/react';
import { createContext, use, useCallback, useId } from 'react';
import { getEntry } from '@/data/data-store';
import type { EntrySection } from '@/entries/sections';
import type { EntryDrop } from '@/widgets/bindings';
import { acceptsDrop, type WidgetBinding, type WidgetType } from '@/widgets/widget-type';

export type EntryDragData = {
	name: string;
	/** The only field of the struct `name`, from rows that show it, see `droppedEntryName()` */
	field?: string | undefined;
	/** The pane whose widget the entry was dragged out of, `undefined` when it's from the entry browser */
	paneId?: string;
	/** The binding the entry was dragged out of, with `paneId` */
	bindingId?: string;
	/** The entry browser section the entry or group was dragged out of, `undefined` when it's from a widget */
	section?: EntrySection;
};

/**
 * The entry a widget binds when `dragged` is dropped on it. Rows showing a struct's only field bind the field to
 * widgets that can't show the struct, ex. an enum logged as a struct dropped on a graph.
 */
export function droppedEntryName(type: WidgetType, { name, field }: Pick<EntryDragData, 'name' | 'field'>): string {
	return field !== undefined && !acceptsDrop(type, name, getEntry(name)) && acceptsDrop(type, field, getEntry(field))
		? field
		: name;
}

type EntryOrientation = 'vertical' | 'horizontal';

/** Data of a widget, or of a widget's bound entry, that entries can be dropped on */
export type EntryDropData = EntryDrop & {
	/** How the widget lays out its entries, so the drop indicator is drawn on the side the entry moves to */
	orientation?: EntryOrientation;
};

export const entryPointerSensor = PointerSensor.configure({
	// Start once the pointer moves, so clicking a group still expands it
	activationConstraints: [new PointerActivationConstraints.Distance({ value: 5 })],
	// Rows for entries with children are mostly the expand button, allow dragging by it
	preventActivation: () => false,
});

/** The entry browser's tree uses Space, Enter, and the arrow keys itself, so its rows can't be picked up from the keyboard */
export const entryRowSensors = [entryPointerSensor];

/** Drag type of entries, accepted by widgets */
export const entryDragType = 'entry';

export function isEntryDrag(source: Draggable | null | undefined): source is Draggable<EntryDragData> {
	return source?.type === entryDragType;
}

/** Drag type of entry browser rows that widgets don't accept, ex. groups, which can only be moved between the entry browser's sections */
export const entryRowDragType = 'entry-row';

export function isEntryRowDrag(source: Draggable | null | undefined): source is Draggable<EntryDragData> {
	return source?.type === entryRowDragType;
}

/** Data of an entry browser row, entries and groups dragged from the entry browser can be dropped on it to move them to its section */
export type EntrySectionDropData = { section: EntrySection };

/** The pane and bindings of the widget being rendered, with the changes its legend can make to them */
export type WidgetBindings = {
	paneId: string;
	bindings: readonly WidgetBinding[];
	setRole: (bindingId: string, role: string) => void;
	connect: (sourceId: string, targetId: string) => void;
	disconnect: (sourceId: string, targetId: string) => void;
	toggleHidden: (bindingId: string) => void;
	/** `undefined` lets the widget pick the binding's color again */
	setColor: (bindingId: string, color: number | undefined) => void;
	/** `undefined` lets the widget pick the binding's robot again */
	setRobot: (bindingId: string, robot: string | undefined) => void;
};

export const WidgetBindingsContext = createContext<WidgetBindings | undefined>(undefined);

/**
 * Lets the element showing a binding, ex. a table row, be dragged to reorder it or move it to another widget.
 * Attach `ref` to the element, and `handleRef` to the part it's dragged by if the whole element shouldn't be (ex. so values stay selectable).
 */
export function useBindingDrag(
	binding: Pick<WidgetBinding, 'id' | 'name'>,
	{
		orientation = 'vertical',
		disabled = false,
		dropRole,
	}: {
		orientation?: EntryOrientation;
		disabled?: boolean;
		/** The role an entry dropped on this one takes, ex. the section of a graph it's in */
		dropRole?: string;
	} = {},
) {
	const widget = use(WidgetBindingsContext);
	const paneId = widget?.paneId ?? '';
	const enabled = widget !== undefined && !disabled;
	const id = useId();
	const { ref: dragRef, handleRef } = useDraggable<EntryDragData>({
		id,
		type: entryDragType,
		disabled: !enabled,
		data: { name: binding.name, paneId, bindingId: binding.id },
	});
	const { ref: dropRef } = useDroppable<EntryDropData>({
		id,
		// Entries dragged from elsewhere are added after the widget's other entries instead
		accept: (source) => source.type === entryDragType && source.data['paneId'] === paneId,
		// dnd-kit's `CollisionPriority.High`, above the widget's own drop target that contains it
		collisionPriority: 3,
		disabled: !enabled,
		data: {
			paneId,
			index: widget?.bindings.findIndex((other) => other.id === binding.id) ?? -1,
			orientation,
			role: dropRole,
		},
	});
	const ref = useCallback(
		(element: Element | null) => {
			dragRef(element);
			dropRef(element);
		},
		[dragRef, dropRef],
	);
	return { ref, handleRef };
}
