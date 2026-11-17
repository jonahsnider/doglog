import type { CSSProperties } from 'react';
import { Panel, type PanelProps } from 'react-resizable-panels';
import type { SplitDirection } from '@/panes/layout';
import type { SplitSide } from '@/panes/split-animation';

/** One side of a split, which keeps its content from reflowing every frame while it animates */
export function SplitPanel({
	direction,
	side,
	ratio,
	sliding,
	staying,
	leavingSize,
	contentHidden,
	children,
	...props
}: Omit<PanelProps, 'style'> & {
	direction: SplitDirection;
	side: SplitSide;
	/** Fraction of the split given to this side */
	ratio: number;
	/** Growing in or shrinking away, or hidden by a zoomed pane on the other side */
	sliding: boolean;
	/** Making room for the other side growing in, or filling in after it shrinks away */
	staying: 'make-room' | 'fill' | undefined;
	/** In pixels, the size a side shrinking away had when it started, since the split around it can change size as it leaves */
	leavingSize: number | undefined;
	/** Skips rendering the hidden side's widgets, but keeps them for when it's restored */
	contentHidden: boolean;
}) {
	const row = direction === 'row';
	// Each side keeps one size while the split animates, measured against the group with container units.
	// The sliding side keeps the size it ends (or starts) at, and is clipped and pinned to the divider so it slides in and out with it.
	// The staying side takes the size it ends at right away, pinned to the outer edge so the other side slides in or out next to it.
	// A zoomed pane fills the split this way at every level, so its content stays where it ends up as the other panes slide away.
	const extent = row ? '100cqw' : '100cqh';
	const size =
		leavingSize === undefined
			? staying === 'fill'
				? extent
				: `calc((${extent} - 1px) * ${ratio})`
			: `${leavingSize}px`;
	const animatedStyle: CSSProperties = {
		flex: 'none',
		// Its size doesn't depend on its content, so the browser can skip laying it out while the split animates
		contain: 'strict',
		...(row ? { width: size } : { height: size }),
		...(contentHidden && { contentVisibility: 'hidden' }),
	};
	const animated = sliding || staying !== undefined;

	return (
		<Panel
			{...props}
			style={
				animated
					? {
							overflow: 'hidden',
							display: 'flex',
							flexDirection: row ? 'row' : 'column',
							justifyContent: (side === 'first') === sliding ? 'flex-end' : 'flex-start',
						}
					: { overflow: 'hidden' }
			}
		>
			<div className="size-full" style={animated ? animatedStyle : undefined}>
				{children}
			</div>
		</Panel>
	);
}
