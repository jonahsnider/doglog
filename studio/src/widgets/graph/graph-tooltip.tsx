import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { type Entry, getTimeRange } from '@/data/data-store';
import { formatValue } from '@/data/format-value';
import { EntryName } from '@/entries/entry-name';
import { modeLabels } from '@/timeline/colors';
import { useHoverTime } from '@/timeline/hover';
import { getModePeriods } from '@/timeline/events';
import { formatTime, useCursorTime } from '@/timeline/timeline';
import type { SeriesUnit } from '@/widgets/graph/axis-units';
import { bandAt, bandHeight, bandTop, changesIn, rowHeight } from '@/widgets/graph/bands';
import { formatInUnit } from '@/widgets/graph/format';
import type { BandHover, PointerAt } from '@/widgets/graph/use-graph-pointer';
import { useViewRange } from '@/widgets/graph/view';
import { bindingColor } from '@/widgets/series-color';
import type { WidgetBinding } from '@/widgets/widget-type';

/** Where the area between the y-axes and the top of the graph are in the window */
type Offset = { left: number; top: number };

const windowMargin = 4;

/**
 * Beside the pointer, on whichever side of the graph has more room, as wide as its content. Drawn over the whole window
 * so other panes don't cut it off, and moved over the pointer only when it would go past the window's edge.
 */
function Popup({ at, top, offset, children }: { at: PointerAt; top: number; offset: Offset; children: ReactNode }) {
	const left = offset.left + at.x + (at.flip ? -12 : 12);
	return createPortal(
		<div
			className="pointer-events-none fixed z-50 w-max rounded-md border bg-popover px-2 py-1.5 text-xs whitespace-nowrap text-popover-foreground shadow-md"
			style={{
				left,
				top: offset.top + top,
				translate: `clamp(${windowMargin - left}px, ${at.flip ? '-100%' : '0px'}, calc(100vw - ${left + windowMargin}px - 100%))`,
			}}
		>
			{children}
		</div>,
		document.body,
	);
}

/** The hovered time and the robot's mode then, ex. `0:12.34 · Teleop` */
function TimeHeader({ time }: { time: number }) {
	const range = getTimeRange();
	if (!range) {
		return undefined;
	}
	const period = getModePeriods(range).findLast((item) => item.start <= time && time <= item.end);
	return (
		<div className="mb-1 text-muted-foreground tabular-nums">
			{formatTime(time, range.start)}
			{period && ` · ${modeLabels[period.mode]}`}
		</div>
	);
}

/**
 * The hovered band's tooltip, or the plotted entries' values at the hovered time, or at the cursor while the tooltip is
 * pinned by clicking
 */
export function GraphTooltip({
	bandHover,
	bandEntry,
	at,
	pinned,
	origin,
	plotted,
	units,
	insets,
}: {
	bandHover: BandHover | undefined;
	bandEntry: Entry | undefined;
	at: PointerAt | undefined;
	pinned: boolean;
	/** Where the graph is in the window */
	origin: { left: number; top: number; width: number } | undefined;
	plotted: readonly WidgetBinding[];
	units: ReadonlyMap<string, SeriesUnit>;
	insets: { left: number; right: number };
}) {
	const hover = useHoverTime();
	const cursor = useCursorTime();
	const view = useViewRange();
	if (!origin) {
		return undefined;
	}
	const offset = { left: origin.left + insets.left, top: origin.top };
	if (bandHover) {
		return <BandTooltip hover={bandHover} entry={bandEntry} offset={offset} />;
	}
	if (plotted.length === 0) {
		return undefined;
	}
	if (at && hover !== undefined) {
		return <LineTooltip at={at} time={hover} plotted={plotted} units={units} offset={offset} />;
	}
	if (!pinned || !view || cursor === undefined || cursor < view.start || cursor > view.end) {
		return undefined;
	}
	const width = origin.width - insets.left - insets.right;
	const x = ((cursor - view.start) / (view.end - view.start)) * width;
	return (
		<LineTooltip at={{ x, width, flip: x > width / 2 }} time={cursor} plotted={plotted} units={units} offset={offset} />
	);
}

function LineTooltip({
	at,
	time,
	plotted,
	units,
	offset,
}: {
	at: PointerAt;
	time: number;
	plotted: readonly WidgetBinding[];
	units: ReadonlyMap<string, SeriesUnit>;
	offset: Offset;
}) {
	return (
		<Popup at={at} top={8} offset={offset}>
			<TimeHeader time={time} />
			<div className="grid grid-cols-[auto_minmax(0,auto)_auto] items-center gap-x-2 gap-y-0.5">
				{plotted.map((binding, index) => {
					const value = binding.entry?.samples.valueAt(time);
					return binding.hidden ? null : (
						<div key={binding.id} className="contents">
							<span className="size-2 rounded-full" style={{ background: bindingColor(binding, index) }} />
							<span className="max-w-64 truncate font-mono">
								<EntryName name={binding.name} />
							</span>
							{/* Wide enough for most values, so the tooltip rarely resizes as they change */}
							<span className="min-w-[10ch] text-end font-mono tabular-nums">
								{value === undefined ? '—' : formatInUnit(value, units.get(binding.id)!)}
							</span>
						</div>
					);
				})}
			</div>
		</Popup>
	);
}

/** The hovered band's value and time range, or how many times the value changes within the hovered pixel */
function BandTooltip({ hover, entry, offset }: { hover: BandHover; entry: Entry | undefined; offset: Offset }) {
	const range = getTimeRange();
	const band = entry && range && bandAt(entry, hover.time, range.end);
	if (!entry || !range || !band) {
		return undefined;
	}
	const from = hover.time - hover.pixel / 2;
	const to = hover.time + hover.pixel / 2;
	const changes = changesIn(entry, from, to);
	return (
		<Popup at={hover} top={hover.top + hover.row * rowHeight + bandTop + bandHeight + 4} offset={offset}>
			<div className="font-mono font-medium">{changes > 1 ? `${changes} changes` : formatValue(band.value)}</div>
			<div className="text-muted-foreground tabular-nums">
				{changes > 1
					? `${formatTime(from, range.start)} - ${formatTime(to, range.start)}`
					: `${formatTime(band.start, range.start)} - ${formatTime(band.end, range.start)}`}
			</div>
		</Popup>
	);
}
