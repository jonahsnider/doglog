import { colorVars, radiusVars, spacingVars } from '@astryxdesign/core/theme/tokens.stylex';
import { useDragDropMonitor } from '@dnd-kit/react';
import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';
import { isPaneDrag, nearestSide } from '@/panes/drag';
import { canMovePane, type PaneNode, type PaneSide } from '@/panes/layout';

/** Insets of the half of a pane that a dropped pane will take */
const sideInsets: Record<PaneSide, string> = {
	left: '0 50% 0 0',
	right: '0 0 0 50%',
	top: '0 0 50% 0',
	bottom: '50% 0 0 0',
};

const styles = stylex.create({
	indicator: {
		pointerEvents: 'none',
		position: 'absolute',
		zIndex: 20,
		margin: spacingVars['--spacing-1'],
		borderRadius: radiusVars['--radius-element'],
		borderWidth: 2,
		borderStyle: 'solid',
	},
	allowed: {
		borderColor: colorVars['--color-accent'],
		backgroundColor: `color-mix(in srgb, ${colorVars['--color-accent']} 10%, transparent)`,
	},
	blocked: {
		borderStyle: 'dashed',
		borderColor: colorVars['--color-border-emphasized'],
		backgroundColor: `color-mix(in srgb, ${colorVars['--color-text-primary']} 12%, transparent)`,
	},
	side: (inset: string) => ({ inset }),
});

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
				{...stylex.props(
					styles.indicator,
					drop.allowed ? styles.allowed : styles.blocked,
					styles.side(sideInsets[drop.side]),
				)}
			/>
		)
	);
}
