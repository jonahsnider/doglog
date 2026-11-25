import {
	colorVars,
	fontWeightVars,
	radiusVars,
	shadowVars,
	spacingVars,
	typeScaleVars,
} from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import type { Dispatch, SetStateAction } from 'react';
import type { histogramBins } from '@/widgets/histogram/data';
import { binCount, binLabel, binValues, type PlotSeries } from '@/widgets/histogram/format';

const styles = stylex.create({
	bins: {
		position: 'absolute',
		inset: 0,
		display: 'flex',
	},
	bin: {
		minWidth: 0,
		flex: 1,
		cursor: 'crosshair',
		backgroundColor: {
			default: null,
			':hover': `color-mix(in srgb, ${colorVars['--color-text-primary']} 8%, transparent)`,
		},
		outline: { default: null, ':focus-visible': '2px solid var(--focus-outline-color)' },
		outlineOffset: { default: null, ':focus-visible': -2 },
	},
	readout: {
		pointerEvents: 'none',
		position: 'absolute',
		top: spacingVars['--spacing-1'],
		zIndex: 10,
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
	range: {
		fontWeight: fontWeightVars['--font-weight-medium'],
		fontVariantNumeric: 'tabular-nums',
	},
	count: {
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-1-5'],
		color: colorVars['--color-text-secondary'],
		fontVariantNumeric: 'tabular-nums',
	},
	dot: {
		width: 8,
		height: 8,
		flexShrink: 0,
		borderRadius: radiusVars['--radius-full'],
	},
});

/** A button over each bin, which shows its readout while it's hovered, focused with the keyboard, or tapped */
export function HistogramBins({
	bins,
	unit,
	series,
	active,
	setActive,
	tabStop,
	setTabStop,
}: {
	bins: ReturnType<typeof histogramBins>['bins'];
	unit: string | undefined;
	series: readonly PlotSeries[];
	active: number | undefined;
	setActive: Dispatch<SetStateAction<number | undefined>>;
	/** The bin focused when tabbing into the plot */
	tabStop: number;
	setTabStop: (index: number) => void;
}) {
	const container = stylex.props(styles.bins);
	return (
		<div
			{...container}
			className={`${container.className} capture-hidden`}
			onPointerLeave={(event) => {
				if (event.pointerType !== 'touch') {
					setActive(undefined);
				}
			}}
		>
			{bins.map((bin, index) => (
				<button
					// oxlint-disable-next-line react/no-array-index-key -- Keep focus on the same column as live bin edges change.
					key={index}
					type="button"
					{...stylex.props(styles.bin)}
					aria-label={binLabel(bin, unit, series, index === bins.length - 1)}
					tabIndex={index === Math.min(tabStop, bins.length - 1) ? 0 : -1}
					onPointerEnter={(event) => {
						if (event.pointerType !== 'touch') {
							setActive(index);
						}
					}}
					onPointerDown={() => setActive(index)}
					onFocus={(event) => {
						setTabStop(index);
						if (event.currentTarget.matches(':focus-visible')) {
							setActive(index);
						}
					}}
					onBlur={() => setActive((current) => (current === index ? undefined : current))}
					onKeyDown={(event) => {
						if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
							event.preventDefault();
							event.stopPropagation();
							const next =
								event.currentTarget[event.key === 'ArrowLeft' ? 'previousElementSibling' : 'nextElementSibling'];
							if (next instanceof HTMLButtonElement) {
								next.focus();
							}
						}
					}}
				/>
			))}
			{active !== undefined && (
				<div
					{...stylex.props(styles.readout)}
					// Beside the bin, on the side with more room
					style={
						active < bins.length / 2
							? { left: `${(active / bins.length) * 100}%` }
							: { right: `${(1 - (active + 1) / bins.length) * 100}%` }
					}
				>
					<div {...stylex.props(styles.range)}>{binValues(bins[active]!, unit, '–')}</div>
					{series.map((item, index) => (
						<div key={item.id} {...stylex.props(styles.count)}>
							{series.length > 1 && <span {...stylex.props(styles.dot)} style={{ background: item.color }} />}
							{binCount(bins[active]!.counts[index]!, item.total)}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
