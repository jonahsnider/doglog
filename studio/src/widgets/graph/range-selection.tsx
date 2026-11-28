import {
	colorVars,
	fontWeightVars,
	radiusVars,
	shadowVars,
	spacingVars,
	typeScaleVars,
	typographyVars,
} from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { useSyncExternalStore } from 'react';
import { type Entry, subscribeData, type TimeRange } from '@/data/data-store';
import { EntryName } from '@/entries/entry-name';
import { formatDuration } from '@/timeline/format-time';
import type { SeriesUnit } from '@/widgets/graph/axis-units';
import { changeAcross, loopsAcross } from '@/widgets/graph/format';
import type { PlotSeries } from '@/widgets/graph/plot';
import { useViewRange } from '@/widgets/graph/view';
import { bindingColor } from '@/widgets/series-color';
import type { WidgetBinding } from '@/widgets/widget-type';

const styles = stylex.create({
	selection: {
		pointerEvents: 'none',
		position: 'absolute',
		top: 0,
		bottom: 0,
		borderInlineWidth: 1,
		borderBlockWidth: 0,
		borderStyle: 'solid',
		borderColor: colorVars['--color-accent'],
		backgroundColor: `color-mix(in srgb, ${colorVars['--color-accent']} 10%, transparent)`,
	},
	label: {
		position: 'absolute',
		top: spacingVars['--spacing-1'],
		left: '50%',
		zIndex: 10,
		translate: '-50% 0',
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
	duration: {
		fontWeight: fontWeightVars['--font-weight-medium'],
		fontVariantNumeric: 'tabular-nums',
	},
	changes: {
		display: 'grid',
		gridTemplateColumns: 'auto minmax(0, auto) auto',
		alignItems: 'center',
		columnGap: spacingVars['--spacing-2'],
		rowGap: spacingVars['--spacing-0-5'],
		marginTop: { default: spacingVars['--spacing-1'], ':empty': 0 },
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
	change: {
		textAlign: 'end',
		fontFamily: typographyVars['--font-family-code'],
		fontVariantNumeric: 'tabular-nums',
	},
});

/** The range selected to measure, labeled with its duration, loops, and each plotted entry's change across it */
export function RangeSelection({
	selection,
	series,
	plotted,
	units,
}: {
	selection: TimeRange;
	series: readonly PlotSeries[];
	plotted: readonly WidgetBinding[];
	units: ReadonlyMap<string, SeriesUnit>;
}) {
	const view = useViewRange();
	const loops = useSyncExternalStore(subscribeData, () =>
		loopsAcross(
			series.filter((line) => !line.hidden).map((line) => line.entry),
			selection,
		),
	);
	if (view === undefined) {
		return undefined;
	}
	const width = view.end - view.start;
	const left = Math.max((selection.start - view.start) / width, 0);
	const right = Math.min((selection.end - view.start) / width, 1);
	if (right <= left) {
		return undefined;
	}
	return (
		<div {...stylex.props(styles.selection)} style={{ left: `${left * 100}%`, width: `${(right - left) * 100}%` }}>
			<div {...stylex.props(styles.label)}>
				<div {...stylex.props(styles.duration)}>
					{' '}
					{formatDuration(selection.end - selection.start)}
					{loops !== undefined && ` · ${loops}`}
				</div>
				<div {...stylex.props(styles.changes)}>
					{plotted.map((binding, index) =>
						binding.entry && !binding.hidden ? (
							<SelectionChange
								key={binding.id}
								entry={binding.entry}
								selection={selection}
								unit={units.get(binding.id)!}
								color={bindingColor(binding, index)}
							/>
						) : null,
					)}
				</div>
			</div>
		</div>
	);
}

function SelectionChange({
	entry,
	selection,
	unit,
	color,
}: {
	entry: Entry;
	selection: TimeRange;
	unit: SeriesUnit;
	color: string;
}) {
	const change = useSyncExternalStore(subscribeData, () => changeAcross(entry, selection, unit));
	return change === undefined ? undefined : (
		<div {...stylex.props(styles.row)}>
			<span {...stylex.props(styles.dot)} style={{ background: color }} />
			<span {...stylex.props(styles.name)}>
				<EntryName name={entry.name} />
			</span>
			<span {...stylex.props(styles.change)}>Δ {change}</span>
		</div>
	);
}
