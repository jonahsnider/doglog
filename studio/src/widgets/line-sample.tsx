import { colorVars, spacingVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import type { LegendItem } from '@/widgets/legend/legend';

const styles = stylex.create({
	sample: {
		flexShrink: 0,
		width: 20,
		height: 12,
	},
	tags: {
		display: 'inline-flex',
		flexShrink: 0,
		alignItems: 'center',
		gap: spacingVars['--spacing-2'],
		whiteSpace: 'nowrap',
		color: colorVars['--color-text-secondary'],
	},
	tag: {
		display: 'inline-flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-0-5'],
	},
});

/**
 * The line styles of `sourceDash()` with round caps like the app's icons: solid, dashed, dotted, and dash-dotted. Drawn
 * at their size in pixels with a 2 px stroke, since smaller dashes and dots are hard to make out.
 */
const samplePaths = [
	'M2 6h16',
	'M3 6h4M13 6h4',
	'M2.5 6h.01M7.5 6h.01M12.5 6h.01M17.5 6h.01',
	'M2 6h4M10 6h.01M14 6h4',
];

/** A short line in the style the visible source at `index` is drawn with, see `sourceDash()` */
export function LineSample({ index, color = 'currentColor' }: { index: number; color?: string | undefined }) {
	return (
		<svg
			aria-hidden
			viewBox="0 0 20 12"
			fill="none"
			stroke={color}
			strokeWidth={2}
			strokeLinecap="round"
			{...stylex.props(styles.sample)}
		>
			<path d={samplePaths[index % samplePaths.length]} />
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
