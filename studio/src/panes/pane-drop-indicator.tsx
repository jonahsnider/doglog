import { useDragDropMonitor } from '@dnd-kit/react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { isPaneDrag, nearestSide } from '@/panes/drag';
import { canMovePane, type PaneNode, type PaneSide } from '@/panes/layout';

/** Insets of the half of a pane that a dropped pane will take */
const sideInsets: Record<PaneSide, string> = {
	left: '0 50% 0 0',
	right: '0 0 0 50%',
	top: '0 0 50% 0',
	bottom: '50% 0 0 0',
};

/** Highlights the half of the pane that a pane dragged over it will take, following the pointer to the nearest side. It jumps between sides without animating. */
export function PaneDropIndicator({ layout, paneId }: { layout: PaneNode; paneId: string }) {
	const [drop, setDrop] = useState<{ side: PaneSide; allowed: boolean }>();
	useDragDropMonitor({
		onDragMove: ({ operation }) => {
			const { source, target, position } = operation;
			if (!isPaneDrag(source) || !target?.element) {
				return;
			}

			const side = nearestSide(target.element.getBoundingClientRect(), position.current);
			const allowed = canMovePane(layout, source.data.paneId, paneId, side);
			if (drop?.side !== side || drop.allowed !== allowed) {
				setDrop({ side, allowed });
			}
		},
	});

	return (
		drop && (
			<div
				className={cn(
					'pointer-events-none absolute z-20 m-1 rounded-md border-2',
					drop.allowed ? 'border-primary bg-primary/10' : 'border-dashed border-muted-foreground/50 bg-muted/50',
				)}
				style={{ inset: sideInsets[drop.side] }}
			/>
		)
	);
}
