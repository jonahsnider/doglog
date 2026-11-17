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
	contentHidden,
	zoomedSize,
	children,
	...props
}: Omit<PanelProps, 'style'> & {
	direction: SplitDirection;
	side: SplitSide;
	/** Fraction of the split given to this side */
	ratio: number;
	/** Growing in or shrinking away, or hidden by a zoomed pane on the other side */
	sliding: boolean;
	/** Skips rendering the hidden side's widgets, but keeps them for when it's restored */
	contentHidden: boolean;
	/** In pixels, set while the zoomed pane is on this side so it's laid out to fill the dashboard as it grows or shrinks */
	zoomedSize: { width: number; height: number } | undefined;
}) {
	const row = direction === 'row';
	// The sliding side keeps the size it ends (or starts) at, measured against the group with container units.
	// It's clipped and pinned to the divider, so it slides in and out with it.
	const size = `calc((${row ? '100cqw' : '100cqh'} - 1px) * ${ratio})`;
	const slidingStyle: CSSProperties = {
		flex: 'none',
		// Its size doesn't depend on its content, so the browser can skip laying it out while the split animates
		contain: 'strict',
		...(row ? { width: size } : { height: size }),
		...(contentHidden && { contentVisibility: 'hidden' }),
	};

	return (
		<Panel
			{...props}
			style={
				sliding
					? {
							overflow: 'hidden',
							display: 'flex',
							flexDirection: row ? 'row' : 'column',
							justifyContent: side === 'first' ? 'flex-end' : 'flex-start',
						}
					: { overflow: 'hidden' }
			}
		>
			<div className="size-full" style={sliding ? slidingStyle : zoomedSize && { ...zoomedSize, contain: 'strict' }}>
				{children}
			</div>
		</Panel>
	);
}
