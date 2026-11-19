import { axisWidth } from '@/widgets/graph/plot';
import { graphSection } from '@/widgets/graph/roles';
import { Legend, type LegendItem } from '@/widgets/legend/legend';
import { bindingColor } from '@/widgets/series-color';
import type { WidgetBinding } from '@/widgets/widget-type';

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
		<div className="flex max-h-[30%] shrink-0 items-start gap-x-6 overflow-y-auto px-2 pt-2 pb-3">
			{left.length > 0 && <Legend items={left} dropRole="left" roles={false} className="min-w-0 flex-1 max-w-max" />}
			{right.length > 0 && (
				<Legend items={right} dropRole="right" roles={false} className="ms-auto min-w-0 flex-1 max-w-max justify-end" />
			)}
		</div>
	);
}

/** The unit of a y-axis, above its labels */
export function AxisUnit({ label, side }: { label: string | undefined; side: 'left' | 'right' }) {
	return label === undefined ? undefined : (
		<span
			className="pointer-events-none absolute top-0.5 truncate px-2 text-xs text-muted-foreground"
			style={{ width: axisWidth, [side]: 0, textAlign: side === 'left' ? 'right' : 'left' }}
		>
			{label}
		</span>
	);
}
