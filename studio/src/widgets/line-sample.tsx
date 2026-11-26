import { colorVars, spacingVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { sourceDash } from '@/widgets/series-color';
import type { LegendItem } from '@/widgets/legend/legend';

const styles = stylex.create({
	sample: {
		flexShrink: 0,
		width: 16,
		height: 6,
	},
	tags: {
		display: 'inline-flex',
		flexShrink: 0,
		alignItems: 'center',
		gap: spacingVars['--spacing-1-5'],
		whiteSpace: 'nowrap',
		color: colorVars['--color-text-secondary'],
	},
	tag: {
		display: 'inline-flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-0-5'],
	},
});

/** A short line in the style the visible source at `index` is drawn with, see `sourceDash()` */
export function LineSample({ index, color = 'currentColor' }: { index: number; color?: string | undefined }) {
	return (
		<svg aria-hidden viewBox="0 0 16 6" {...stylex.props(styles.sample)}>
			<line
				x1={0}
				y1={3}
				x2={16}
				y2={3}
				stroke={color}
				strokeWidth={1.5}
				strokeDasharray={sourceDash(index).join(' ')}
			/>
		</svg>
	);
}

/** Labels each source a binding is drawn from with its line style, only while several sources are visible */
export function SourceTags({ item: { binding, color, icon } }: { item: LegendItem }) {
	if (binding.source?.labeled !== true) {
		return undefined;
	}
	const tags = [binding.source, ...binding.others.map((other) => other.source)];
	return (
		<span {...stylex.props(styles.tags)}>
			{tags.map((tag) => (
				<span key={tag.id} {...stylex.props(styles.tag)}>
					<LineSample index={tag.index} color={icon === undefined ? color : undefined} />
					{tag.label}
				</span>
			))}
		</span>
	);
}
