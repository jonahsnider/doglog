import { colorVars, radiusVars, shadowVars, spacingVars, typeScaleVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { PointerAt } from '@/widgets/graph/tooltip-side';

/** Where the area between the y-axes and the top of the graph are in the window */
export type Offset = { left: number; top: number };

const windowMargin = 4;

const styles = stylex.create({
	popup: {
		pointerEvents: 'none',
		position: 'fixed',
		zIndex: 50,
		width: 'max-content',
		borderRadius: radiusVars['--radius-element'],
		borderWidth: 1,
		borderStyle: 'solid',
		borderColor: colorVars['--color-border'],
		backgroundColor: colorVars['--color-background-popover'],
		paddingInline: spacingVars['--spacing-2'],
		paddingBlock: spacingVars['--spacing-1-5'],
		fontSize: typeScaleVars['--text-supporting-size'],
		lineHeight: '1rem',
		whiteSpace: 'nowrap',
		color: colorVars['--color-text-primary'],
		boxShadow: shadowVars['--shadow-med'],
	},
});

/**
 * Beside the pointer, on whichever side of the graph has more room, as wide as its content, with its top at `top`, or
 * its bottom when `above`. Drawn over the whole window so other panes don't cut it off, and moved over the pointer only
 * when it would go past the window's edge.
 */
export function Popup({
	at,
	top,
	above = false,
	offset,
	bounds,
	children,
}: {
	at: PointerAt;
	top: number;
	above?: boolean;
	offset: Offset;
	bounds?: DOMRect | undefined;
	children: ReactNode;
}) {
	const left = offset.left + at.x + (at.flip ? -12 : 12);
	const y = offset.top + top;
	const rightEdge = bounds ? `${bounds.right}px` : '100vw';
	const bottomEdge = bounds ? `${bounds.bottom}px` : '100vh';
	const minX = (bounds?.left ?? 0) + windowMargin - left;
	const minY = (bounds?.top ?? 0) + windowMargin - y;
	return createPortal(
		<div
			{...stylex.props(styles.popup)}
			style={{
				left,
				top: y,
				translate: `clamp(${minX}px, ${at.flip ? '-100%' : '0px'}, calc(${rightEdge} - ${left + windowMargin}px - 100%)) clamp(${minY}px, ${above ? '-100%' : '0px'}, calc(${bottomEdge} - ${y + windowMargin}px - 100%))`,
				...(bounds && {
					maxWidth: bounds.width - windowMargin * 2,
					maxHeight: bounds.height - windowMargin * 2,
					overflow: 'hidden',
				}),
			}}
		>
			{children}
		</div>,
		document.body,
	);
}
