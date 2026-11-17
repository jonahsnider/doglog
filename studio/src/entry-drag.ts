import type { Draggable } from '@dnd-kit/dom';
import { useDraggable, useDroppable } from '@dnd-kit/react';
import { createContext, use, useCallback, useId } from 'react';
import type { EntrySection } from '@/entry-sections';
import type { EntryDrop } from '@/pane-layout';

/** Data of a dragged entry */
export type EntryDragData = {
	name: string;
	/** The pane whose widget the entry was dragged out of, `undefined` when it's from the entry browser */
	paneId?: string;
	/** The entry browser section the entry or group was dragged out of, `undefined` when it's from a widget */
	section?: EntrySection;
};

type EntryOrientation = 'vertical' | 'horizontal';

/** Data of a widget, or of a widget's bound entry, that entries can be dropped on */
export type EntryDropData = EntryDrop & {
	/** How the widget lays out its entries, so the drop indicator is drawn on the side the entry moves to */
	orientation?: EntryOrientation;
};

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

/** The pane and bound entries of the widget being rendered */
export const WidgetEntriesContext = createContext<{ paneId: string; entryNames: readonly string[] } | undefined>(
	undefined,
);

/**
 * Lets the element showing a bound entry, ex. a values table row, be dragged to reorder the entry or move it to another widget.
 * Attach `ref` to the element, and `handleRef` to the part it's dragged by if the whole element shouldn't be (ex. so values stay selectable).
 */
export function useEntryDrag(
	name: string,
	{ orientation = 'vertical', disabled = false }: { orientation?: EntryOrientation; disabled?: boolean } = {},
) {
	const widget = use(WidgetEntriesContext);
	const paneId = widget?.paneId ?? '';
	const enabled = widget !== undefined && !disabled;
	const id = useId();
	const { ref: dragRef, handleRef } = useDraggable<EntryDragData>({
		id,
		type: entryDragType,
		disabled: !enabled,
		data: { name, paneId },
	});
	const { ref: dropRef } = useDroppable<EntryDropData>({
		id,
		// Entries dragged from elsewhere are added after the widget's other entries instead
		accept: (source) => source.type === entryDragType && source.data['paneId'] === paneId,
		// dnd-kit's `CollisionPriority.High`, above the widget's own drop target that contains it
		collisionPriority: 3,
		disabled: !enabled,
		data: { paneId, index: widget?.entryNames.indexOf(name) ?? -1, orientation },
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
