import type { Draggable, Droppable } from '@dnd-kit/dom';
import { useDragOperation, useDroppable } from '@dnd-kit/react';
import { use } from 'react';
import { getEntry } from '@/data/data-store';
import {
	type EntryDragData,
	type EntryDropData,
	entryDragType,
	isEntryDrag,
	WidgetBindingsContext,
} from '@/entries/drag';
import { cn } from '@/lib/utils';
import { type GraphSection, graphRoles, graphSection } from '@/widgets/graph/roles';

/**
 * The sections a dragged entry can be shown in, ex. strings can only be bands. Rows showing a struct's only field go
 * where the field can, see `droppedEntryName()`.
 */
function sectionsOf({ name, field }: Pick<EntryDragData, 'name' | 'field'>): GraphSection[] {
	for (const candidate of [name, field]) {
		const entry = candidate === undefined ? undefined : getEntry(candidate);
		const roles = entry ? graphRoles(entry) : [];
		if (roles.length > 0) {
			return roles.map((role) => graphSection(role));
		}
	}
	return [];
}

/**
 * Like splitting a pane, dragging an entry over the graph, or one of its own entries anywhere, covers it with zones to
 * drop the entry on: the left and right halves for its axes, and the bands at the bottom
 */
export function DropZones({ bandsHeight }: { bandsHeight: number }) {
	const paneId = use(WidgetBindingsContext)?.paneId ?? '';
	const { source, target } = useDragOperation<
		EntryDragData | EntryDropData,
		Draggable<EntryDragData>,
		Droppable<EntryDropData>
	>();
	const drop = target?.data;
	const shown =
		isEntryDrag(source) && (source.data.paneId === paneId || (drop !== undefined && drop.paneId === paneId));
	if (!shown) {
		return undefined;
	}
	const sections = sectionsOf(source.data);
	// Dropping on the graph's entries also moves the dragged entry to their section
	const over = drop?.paneId === paneId ? drop.role : undefined;
	const zone = (section: GraphSection, label: string) =>
		sections.includes(section) && (
			<Zone key={section} paneId={paneId} section={section} label={label} active={over === section} />
		);
	const plottable = sections.includes('left');
	return (
		<div className="pointer-events-none absolute inset-0 z-20 flex flex-col p-1">
			{plottable && (
				<div className="flex min-h-0 flex-1">
					{zone('left', 'Left axis')}
					{zone('right', 'Right axis')}
				</div>
			)}
			<div className={cn('flex', !plottable && 'flex-1')} style={{ height: Math.max(bandsHeight, 48) }}>
				{zone('discrete', 'Bands')}
			</div>
		</div>
	);
}

function Zone({
	paneId,
	section,
	label,
	active,
}: {
	paneId: string;
	section: GraphSection;
	label: string;
	active: boolean;
}) {
	const { ref } = useDroppable<EntryDropData>({
		id: `${paneId}:${section}`,
		accept: (source) => {
			const { name, field } = source.data;
			return (
				source.type === entryDragType &&
				sectionsOf({ name: String(name), field: typeof field === 'string' ? field : undefined }).includes(section)
			);
		},
		// Above the widget's own drop target, below its entries, which take the dropped entry's place among them
		collisionPriority: 2,
		data: { paneId, role: section },
	});
	return (
		<div
			ref={ref}
			className={cn(
				'm-1 flex min-w-0 flex-1 items-center justify-center rounded-md border-2 border-dashed border-muted-foreground/40 bg-background/70 text-sm font-medium text-muted-foreground backdrop-blur-[2px]',
				active && 'border-solid border-primary bg-primary/10 text-primary',
			)}
		>
			{label}
		</div>
	);
}
