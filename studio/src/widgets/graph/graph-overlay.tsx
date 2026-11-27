import {
	colorVars,
	fontWeightVars,
	radiusVars,
	spacingVars,
	typeScaleVars,
} from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import type { TimeRange } from '@/data/data-store';
import type { SeriesUnit } from '@/widgets/graph/axis-units';
import type { PlotSeries } from '@/widgets/graph/plot';
import { RangeSelection } from '@/widgets/graph/range-selection';
import type { GraphElements } from '@/widgets/graph/use-graph-drawing';
import type { WidgetBinding } from '@/widgets/widget-type';

const styles = stylex.create({
	area: {
		pointerEvents: 'none',
		position: 'absolute',
		top: 0,
		bottom: 0,
	},
	line: {
		position: 'absolute',
		top: 0,
		bottom: 0,
		width: 1,
		translate: '-50% 0',
	},
	hoverLine: {
		backgroundColor: colorVars['--color-text-secondary'],
	},
	cursorLine: {
		backgroundColor: colorVars['--color-text-primary'],
	},
	dots: {
		position: 'absolute',
		top: 0,
		left: 0,
	},
	dot: {
		position: 'absolute',
		top: -4,
		left: -4,
		width: 8,
		height: 8,
		borderRadius: radiusVars['--radius-full'],
		boxShadow: `0 0 0 2px ${colorVars['--color-background-surface']}`,
	},
	delta: {
		position: 'absolute',
		height: 8,
		'::before': {
			content: '""',
			position: 'absolute',
			top: 0,
			bottom: 0,
			left: -1,
			right: -1,
			borderStyle: 'solid',
			borderWidth: 0,
			borderLeftWidth: 'var(--delta-left-stroke)',
			borderRightWidth: 'var(--delta-right-stroke)',
			borderBottomWidth: 2,
			borderColor: colorVars['--color-accent'],
		},
	},
	deltaHidden: {
		display: 'none',
	},
	deltaLabel: {
		position: 'absolute',
		bottom: '100%',
		left: '50%',
		width: 'max-content',
		translate: 'var(--delta-label-shift) 0',
		borderRadius: radiusVars['--radius-inner'],
		borderWidth: 1,
		borderStyle: 'solid',
		borderColor: colorVars['--color-accent'],
		backgroundColor: colorVars['--color-background-surface'],
		paddingInline: spacingVars['--spacing-1-5'],
		fontSize: typeScaleVars['--text-supporting-size'],
		lineHeight: '1rem',
		fontWeight: fontWeightVars['--font-weight-medium'],
		color: colorVars['--color-text-primary'],
		fontVariantNumeric: 'tabular-nums',
	},
});

/** Adds a global class to an element's StyleX props */
function withClass(props: ReturnType<typeof stylex.props>, className: string) {
	return { ...props, className: `${props.className} ${className}` };
}

/** Spans the plot and bands between the y-axes, with the lines and dots drawing moves to the hovered and cursor times */
export function GraphOverlay({
	areaRef,
	gapsRef,
	hoverLineRef,
	cursorLineRef,
	hoverDotsRef,
	hoverDeltaRef,
	series,
	selection,
	plotted,
	units,
	insets,
	deltaHidden,
	deltaBottom,
}: {
	areaRef: GraphElements['area'];
	gapsRef: GraphElements['gaps'];
	hoverLineRef: GraphElements['hoverLine'];
	cursorLineRef: GraphElements['cursorLine'];
	hoverDotsRef: GraphElements['hoverDots'];
	hoverDeltaRef: GraphElements['hoverDelta'];
	series: readonly PlotSeries[];
	selection: TimeRange | undefined;
	plotted: readonly WidgetBinding[];
	units: ReadonlyMap<string, SeriesUnit>;
	insets: { left: number; right: number };
	deltaHidden: boolean;
	deltaBottom: number;
}) {
	return (
		<div ref={areaRef} {...stylex.props(styles.area)} style={{ left: insets.left, right: insets.right }}>
			<div ref={gapsRef} />
			{selection && <RangeSelection selection={selection} plotted={plotted} units={units} />}
			<div ref={hoverLineRef} hidden {...withClass(stylex.props(styles.line, styles.hoverLine), 'capture-invisible')} />
			<div ref={cursorLineRef} hidden {...stylex.props(styles.line, styles.cursorLine)} />
			<div ref={hoverDotsRef} {...withClass(stylex.props(styles.dots), 'capture-invisible')}>
				{series.map((line) => (
					<div key={line.id} hidden {...stylex.props(styles.dot)} style={{ background: line.color }} />
				))}
			</div>
			{/* The 2px end strokes extend 1px to either side of each time marker. */}
			<div
				ref={hoverDeltaRef}
				hidden
				{...withClass(stylex.props(styles.delta, deltaHidden && styles.deltaHidden), 'capture-invisible')}
				style={{ bottom: deltaBottom }}
			>
				<span {...stylex.props(styles.deltaLabel)} />
			</div>
		</div>
	);
}
