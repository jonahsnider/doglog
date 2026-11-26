import { colorVars, spacingVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import type { LegendItem } from '@/widgets/legend/legend';

const styles = stylex.create({
	sample: {
		flexShrink: 0,
		width: 16,
		height: 16,
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
 * The line styles of `sourceDash()` drawn like the app's icons: on a 24 px grid with round caps, ex. solid like a minus,
 * then dashed, dotted, and dash-dotted
 */
const samplePaths = [
	'M4 12h16',
	'M4 12h5M15 12h5',
	'M4 12h.01M9.33 12h.01M14.67 12h.01M20 12h.01',
	'M4 12h4M12 12h.01M16 12h4',
];

/** A short line in the style the visible source at `index` is drawn with, see `sourceDash()` */
export function LineSample({ index, color = 'currentColor' }: { index: number; color?: string | undefined }) {
	return (
		<svg
			aria-hidden
			viewBox="0 0 24 24"
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
