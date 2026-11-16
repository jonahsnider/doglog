import { type Draggable, PointerActivationConstraints } from '@dnd-kit/dom';
import { DragDropProvider, DragOverlay, KeyboardSensor, PointerSensor } from '@dnd-kit/react';
import type { ReactNode } from 'react';
import { EntryName } from '@/components/entry-name';
import type { EntryDragData } from '@/entry-drag';

const sensors = [
	PointerSensor.configure({
		// Start once the pointer moves, so clicking a group still expands it
		activationConstraints: [new PointerActivationConstraints.Distance({ value: 5 })],
		// Rows for entries with children are mostly the expand button, allow dragging by it
		preventActivation: () => false,
	}),
	KeyboardSensor,
];

/** Lets entries be dragged from the entry browser onto widgets, and between and within widgets */
export function EntryDragProvider({ children }: { children: ReactNode }) {
	return (
		<DragDropProvider sensors={sensors}>
			{children}
			{/* Entry browser rows are virtualized and can unmount mid-drag, the overlay is what follows the pointer */}
			<DragOverlay<EntryDragData, Draggable<EntryDragData>> dropAnimation={null}>
				{(source) => (
					<div className="w-max max-w-80 truncate rounded-md border bg-popover px-2 py-1 font-mono text-xs text-popover-foreground shadow-md">
						<EntryName name={source.data.name} />
					</div>
				)}
			</DragOverlay>
		</DragDropProvider>
	);
}
