import {
	colorVars,
	fontWeightVars,
	radiusVars,
	spacingVars,
	typographyVars,
} from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { use, useSyncExternalStore } from 'react';
import { type Entry, subscribeData, useTimeRange } from '@/data/data-store';
import { formatValue } from '@/data/format-value';
import { useCaptureFrame } from '@/desktop/capture';
import { WidgetBindingsContext } from '@/entries/drag';
import { EntryName } from '@/entries/entry-name';
import { modeFills, modeLabels } from '@/timeline/colors';
import { getModePeriods } from '@/timeline/events';
import { useHoverTime } from '@/timeline/hover';
import { formatTime, useCursorTime } from '@/timeline/timeline';
import type { SeriesUnit } from '@/widgets/graph/axis-units';
import { bandAt, bandHeight, bandTop, changesIn, rowHeight } from '@/widgets/graph/bands';
import { bandColor, type BandPalette, type ColorAssignments } from '@/widgets/graph/colors';
import { formatInUnit } from '@/widgets/graph/format';
import { type Offset, Popup } from '@/widgets/graph/popup';
import type { BandHover, LineHover, PointerAt } from '@/widgets/graph/tooltip-side';
import { useViewRange } from '@/widgets/graph/view';
import { bindingColor } from '@/widgets/series-color';
import type { WidgetBinding } from '@/widgets/widget-type';

const styles = stylex.create({
	header: {
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-3'],
		marginBottom: spacingVars['--spacing-2'],
		color: colorVars['--color-text-secondary'],
		fontVariantNumeric: 'tabular-nums',
	},
	mode: {
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-1-5'],
	},
	values: {
		display: 'grid',
		gridTemplateColumns: 'auto minmax(0, auto) auto',
		alignItems: 'center',
		columnGap: spacingVars['--spacing-2'],
		rowGap: spacingVars['--spacing-0-5'],
	},
	row: {
		display: 'contents',
	},
	dot: {
		width: 8,
		height: 8,
		borderRadius: radiusVars['--radius-full'],
	},
	name: {
		maxWidth: '16rem',
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		whiteSpace: 'nowrap',
		fontFamily: typographyVars['--font-family-code'],
	},
	source: {
		fontFamily: typographyVars['--font-family-body'],
		color: colorVars['--color-text-secondary'],
	},
	value: {
		// Wide enough for most values, so the tooltip rarely resizes as they change
		minWidth: '10ch',
		textAlign: 'end',
		fontFamily: typographyVars['--font-family-code'],
		fontVariantNumeric: 'tabular-nums',
	},
	bandValue: {
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-2'],
		fontFamily: typographyVars['--font-family-code'],
		fontWeight: fontWeightVars['--font-weight-medium'],
	},
	bandTime: {
		color: colorVars['--color-text-secondary'],
		fontVariantNumeric: 'tabular-nums',
	},
});

/** The hovered time and the robot's mode then, with the mode's color from the timeline */
function TimeHeader({ time }: { time: number }) {
	const range = useTimeRange();
	if (!range) {
		return undefined;
	}
	const period = getModePeriods(range).findLast((item) => item.start <= time && time <= item.end);
	return (
		<div {...stylex.props(styles.header)}>
			{formatTime(time, range.start)}
			{period && (
				<span {...stylex.props(styles.mode)}>
					<span
						aria-hidden="true"
						{...stylex.props(styles.dot)}
						// Disabled is uncolored on the timeline, so it gets the same gray the timeline's tooltip uses
						style={{ background: modeFills[period.mode] ?? 'var(--color-border-emphasized)' }}
					/>
					{modeLabels[period.mode]}
				</span>
			)}
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
	palette,
	assignments,
	at,
	pinned,
	origin,
	plotted,
	units,
	insets,
}: {
	bandHover: BandHover | undefined;
	bandEntry: Entry | undefined;
	palette: BandPalette;
	assignments: ColorAssignments;
	at: LineHover | undefined;
	pinned: boolean;
	/** Where the graph is in the window */
	origin: { left: number; top: number; width: number } | undefined;
	plotted: readonly WidgetBinding[];
	units: ReadonlyMap<string, SeriesUnit>;
	insets: { left: number; right: number };
}) {
	const frame = useCaptureFrame();
	const paneId = use(WidgetBindingsContext)?.paneId;
	if (!origin || (frame && !frame.paneIds.has(paneId))) {
		return undefined;
	}
	const offset = { left: origin.left + insets.left, top: origin.top };
	if (bandHover && !frame) {
		return (
			<BandTooltip hover={bandHover} entry={bandEntry} palette={palette} assignments={assignments} offset={offset} />
		);
	}
	if (plotted.length === 0) {
		return undefined;
	}
	if (at && !frame) {
		// Diagonally off the pointer, toward the middle of the graph, so it moves out of the way of what's hovered
		return (
			<LineTooltip
				at={at}
				time={at.time}
				top={at.y + (at.above ? -12 : 12)}
				above={at.above}
				plotted={plotted}
				units={units}
				offset={offset}
			/>
		);
	}
	return pinned ? (
		<PinnedTooltip
			width={origin.width - insets.left - insets.right}
			plotted={plotted}
			units={units}
			offset={offset}
			bounds={frame?.bounds}
		/>
	) : undefined;
}

// Only a pinned tooltip that's following the cursor needs to subscribe to playback. It steps aside while another graph
// or the timeline is hovered, since that graph shows its own.
function PinnedTooltip({ width, ...props }: Omit<LineTooltipProps, 'at' | 'time' | 'top'> & { width: number }) {
	const cursor = useCursorTime();
	const view = useViewRange();
	const hoveringElsewhere = useHoverTime() !== undefined;
	if (
		(hoveringElsewhere && !props.bounds) ||
		!view ||
		cursor === undefined ||
		cursor < view.start ||
		cursor > view.end
	) {
		return undefined;
	}
	const x = ((cursor - view.start) / (view.end - view.start)) * width;
	return <LineTooltip {...props} at={{ x, width, flip: x > width / 2 }} time={cursor} top={8} />;
}

type LineTooltipProps = {
	at: PointerAt;
	time: number;
	top: number;
	above?: boolean;
	plotted: readonly WidgetBinding[];
	units: ReadonlyMap<string, SeriesUnit>;
	offset: Offset;
	bounds?: DOMRect | undefined;
};

function LineTooltip({ at, time, top, above, plotted, units, offset, bounds }: LineTooltipProps) {
	return (
		<Popup at={at} top={top} above={above} offset={offset} bounds={bounds}>
			<TimeHeader time={time} />
			<div {...stylex.props(styles.values)}>
				{plotted.flatMap((binding, index) => {
					if (binding.hidden) {
						return [];
					}
					const sources = binding.entry
						? [{ entry: binding.entry, source: binding.source }, ...binding.others]
						: [{ entry: undefined, source: undefined }];
					return sources.map(({ entry, source }) => (
						<div key={`${binding.id}:${source?.id}`} {...stylex.props(styles.row)}>
							<span {...stylex.props(styles.dot)} style={{ background: bindingColor(binding, index) }} />
							<span {...stylex.props(styles.name)}>
								<EntryName name={binding.name} />
								{source?.labeled === true && <span {...stylex.props(styles.source)}> {source.label}</span>}
							</span>
							<LineValue entry={entry} time={time} unit={units.get(binding.id)!} />
						</div>
					));
				})}
			</div>
		</Popup>
	);
}

function LineValue({ entry, time, unit }: { entry: Entry | undefined; time: number; unit: SeriesUnit }) {
	const value = useSyncExternalStore(subscribeData, () => entry?.samples.valueAt(time));
	return <span {...stylex.props(styles.value)}>{value === undefined ? '—' : formatInUnit(value, unit)}</span>;
}

/** The hovered band's value and time range, or how many times the value changes within the hovered pixel */
function BandTooltip({
	hover,
	entry,
	palette,
	assignments,
	offset,
}: {
	hover: BandHover;
	entry: Entry | undefined;
	palette: BandPalette;
	assignments: ColorAssignments;
	offset: Offset;
}) {
	const range = useTimeRange();
	const band = entry && range && bandAt(entry, hover.time, range.end);
	if (!entry || !range || !band) {
		return undefined;
	}
	const from = hover.time - hover.pixel / 2;
	const to = hover.time + hover.pixel / 2;
	const changes = changesIn(entry, from, to);
	const color = changes > 1 ? undefined : bandColor(assignments, palette, entry, band.value, 'lookup');
	return (
		<Popup at={hover} top={hover.top + hover.row * rowHeight + bandTop + bandHeight + 4} offset={offset}>
			<div {...stylex.props(styles.bandValue)}>
				{color !== undefined && <span aria-hidden="true" {...stylex.props(styles.dot)} style={{ background: color }} />}
				{changes > 1 ? `${changes} changes` : formatValue(band.value)}
			</div>
			<div {...stylex.props(styles.bandTime)}>
				{changes > 1
					? `${formatTime(from, range.start)} - ${formatTime(to, range.start)}`
					: `${formatTime(band.start, range.start)} - ${formatTime(band.end, range.start)}`}
			</div>
		</Popup>
	);
}
