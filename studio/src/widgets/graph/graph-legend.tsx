import { colorVars, spacingVars, typeScaleVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { axisWidth } from '@/widgets/graph/plot';
import { graphSection } from '@/widgets/graph/roles';
import { Legend, type LegendItem } from '@/widgets/legend/legend';
import { bindingColor } from '@/widgets/series-color';
import type { WidgetBinding } from '@/widgets/widget-type';

const styles = stylex.create({
	legends: {
		display: 'flex',
		maxHeight: '30%',
		flexShrink: 0,
		alignItems: 'flex-start',
		columnGap: spacingVars['--spacing-6'],
		overflowY: 'auto',
		paddingInline: spacingVars['--spacing-2'],
		paddingTop: spacingVars['--spacing-2'],
		paddingBottom: spacingVars['--spacing-3'],
	},
	side: {
		minWidth: 0,
		flex: 1,
		maxWidth: 'max-content',
	},
	right: {
		marginInlineStart: 'auto',
		justifyContent: 'flex-end',
	},
	unit: {
		pointerEvents: 'none',
		position: 'absolute',
		top: spacingVars['--spacing-0-5'],
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		whiteSpace: 'nowrap',
		paddingInline: spacingVars['--spacing-2'],
		fontSize: typeScaleVars['--text-supporting-size'],
		lineHeight: '1rem',
		color: colorVars['--color-text-secondary'],
	},
});

/**
 * Left axis entries on the left and right axis entries on the right, named by the last segments that tell them apart
 * when their full names don't fit. Values are shown in the hover tooltip, and entries are moved between axes by dragging
 * them or from their context menu.
 */
export function GraphLegend({ plotted }: { plotted: readonly WidgetBinding[] }) {
	const names = plotted.map((binding) => binding.name);
	const items = plotted.map((binding, index): LegendItem & { right: boolean } => ({
		binding,
		color: bindingColor(binding, index),
		dimmed: binding.entry === undefined,
		distinctFrom: names,
		right: graphSection(binding.role) === 'right',
	}));
	const left = items.filter((item) => !item.right);
	const right = items.filter((item) => item.right);
	return items.length === 0 ? undefined : (
		// Each side takes up to half the width and wraps within it, or more when the other side is shorter. Long legends
		// scroll, so the plot keeps most of the widget.
		<div {...stylex.props(styles.legends)}>
			{left.length > 0 && (
				<Legend items={left} dropRole="left" roles={false} className={stylex.props(styles.side).className} />
			)}
			{right.length > 0 && (
				<Legend
					items={right}
					dropRole="right"
					roles={false}
					className={stylex.props(styles.side, styles.right).className}
				/>
			)}
		</div>
	);
}

/** The unit of a y-axis, above its labels */
export function AxisUnit({ label, side }: { label: string | undefined; side: 'left' | 'right' }) {
	return label === undefined ? undefined : (
		<span
			{...stylex.props(styles.unit)}
			style={{ width: axisWidth, [side]: 0, textAlign: side === 'left' ? 'right' : 'left' }}
		>
			{label}
		</span>
	);
}
