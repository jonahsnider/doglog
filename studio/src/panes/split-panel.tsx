import * as stylex from '@stylexjs/stylex';
import { useLayoutEffect, useRef } from 'react';
import { Panel, type PanelProps } from 'react-resizable-panels';
import type { SplitDirection } from '@/panes/layout';
import { dividerSize } from '@/panes/pane-size';

/** How a child of a split takes part in its animation, see `SplitView` */
export type SplitPanelAnimation = {
	/** Growing in from nothing, shrinking away, or resizing to make room or fill in */
	role: 'enter' | 'leave' | 'stay';
	/** Its share of the split before the animation, as a percentage */
	from: number;
	/** In the closing timing, which is quicker and accelerates */
	closing: boolean;
	/** Its share of the split it keeps while animating: the one it ends at, or starts at when leaving */
	size: number;
	/** Dividers in the split when it has that share */
	dividers: number;
	/** The edge its content is pinned to, the other children move in or out next to it */
	pin: 'start' | 'end';
};

const styles = stylex.create({
	content: { width: '100%', height: '100%' },
	// Its size doesn't depend on its content, so the browser can skip laying it out while the split animates
	animatingRow: (width: string) => ({ flex: 'none', contain: 'strict', width }),
	animatingColumn: (height: string) => ({ flex: 'none', contain: 'strict', height }),
});

/** One child of a split, which keeps its content from reflowing every frame while it animates */
export function SplitPanel({
	direction,
	animation,
	hidden,
	zooming,
	children,
	...props
}: Omit<PanelProps, 'style' | 'elementRef'> & {
	direction: SplitDirection;
	animation: SplitPanelAnimation | undefined;
	/** Hidden by a zoomed pane in another child of the split */
	hidden: boolean;
	/** Whether a zoom is animating, which moves panes outside their splits */
	zooming: boolean;
}) {
	const row = direction === 'row';
	// Its content keeps one size while the split animates, measured against the split with container units
	const size = `calc((${row ? '100cqw' : '100cqh'} - ${(animation?.dividers ?? 0) * dividerSize}px) * ${animation?.size ?? 1})`;
	// Read by the keyframes in `index.css`, set on the panel itself since its `style` goes to an element inside it
	const element = useRef<HTMLDivElement>(null);
	const from = String(animation?.from ?? 0);
	useLayoutEffect(() => {
		element.current?.style.setProperty('--split-from', from);
	}, [from]);

	return (
		<Panel
			{...props}
			data-split-animation={animation?.role}
			data-split-closing={animation?.closing === true || undefined}
			data-split-hidden={hidden || undefined}
			elementRef={element}
			style={
				animation
					? {
							overflow: 'hidden',
							display: 'flex',
							flexDirection: row ? 'row' : 'column',
							justifyContent: animation.pin === 'start' ? 'flex-start' : 'flex-end',
						}
					: { overflow: zooming ? 'visible' : 'hidden' }
			}
		>
			<div
				{...stylex.props(styles.content, animation && (row ? styles.animatingRow(size) : styles.animatingColumn(size)))}
			>
				{children}
			</div>
		</Panel>
	);
}
