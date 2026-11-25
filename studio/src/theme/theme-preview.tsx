import { radiusVars, shadowVars, spacingVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import type { Theme } from '@/theme/choices';
import type { ThemePreviewColors } from '@/theme/theme-color';

const styles = stylex.create({
	preview: {
		display: 'block',
		position: 'relative',
		aspectRatio: '16 / 10',
	},
	previewFrame: {
		position: 'absolute',
		inset: 0,
		display: 'flex',
		overflow: 'hidden',
		borderWidth: 1,
		borderStyle: 'solid',
		borderRadius: radiusVars['--radius-inner'],
	},
	previewDarkHalf: {
		clipPath: 'inset(0 0 0 50%)',
	},
	previewSidebar: {
		display: 'flex',
		flexDirection: 'column',
		gap: spacingVars['--spacing-1'],
		width: '25%',
		padding: spacingVars['--spacing-1-5'],
		borderInlineEndWidth: 1,
		borderInlineEndStyle: 'solid',
	},
	previewContent: {
		display: 'flex',
		flex: 1,
		flexDirection: 'column',
		gap: spacingVars['--spacing-1-5'],
		padding: spacingVars['--spacing-2'],
	},
	previewBar: {
		height: spacingVars['--spacing-1-5'],
		borderRadius: radiusVars['--radius-full'],
	},
	previewAccent: {
		height: spacingVars['--spacing-2'],
		marginBlockEnd: spacingVars['--spacing-1'],
		borderRadius: radiusVars['--radius-full'],
	},
	previewButton: {
		width: '33%',
		height: spacingVars['--spacing-2'],
		marginBlockStart: 'auto',
		marginInlineStart: 'auto',
		borderRadius: radiusVars['--radius-full'],
	},
	swatch: {
		display: 'block',
		width: spacingVars['--spacing-8'],
		aspectRatio: '1',
		borderWidth: 1,
		borderStyle: 'solid',
		borderRadius: radiusVars['--radius-full'],
		boxShadow: shadowVars['--shadow-low'],
		// The border is translucent, so the gradient has to reach under it instead of repeating there
		backgroundOrigin: 'border-box',
	},
	fill: (color: string) => ({ backgroundColor: color }),
	edge: (color: string) => ({ borderColor: color }),
	gradient: (from: string, to: string) => ({
		backgroundImage: `linear-gradient(in oklch 45deg, ${from} 25%, ${to} 75%)`,
	}),
	width: (width: string) => ({ width }),
});

/** Previews Studio in a theme, with system showing the light and dark themes side by side */
export function ThemeModePreview({
	theme,
	light,
	dark,
}: {
	theme: Theme;
	light: ThemePreviewColors;
	dark: ThemePreviewColors;
}) {
	return (
		<span {...stylex.props(styles.preview)}>
			<ThemePreview colors={theme === 'dark' ? dark : light} />
			{theme === 'system' && <ThemePreview colors={dark} darkHalf />}
		</span>
	);
}

/** A sketch of Studio's layout in a theme's colors */
function ThemePreview({ colors, darkHalf = false }: { colors: ThemePreviewColors; darkHalf?: boolean }) {
	const bar = <span {...stylex.props(styles.previewBar, styles.fill(colors.bar))} />;
	return (
		<span
			aria-hidden="true"
			{...stylex.props(
				styles.previewFrame,
				styles.fill(colors.surface),
				styles.edge(colors.border),
				darkHalf && styles.previewDarkHalf,
			)}
		>
			<span {...stylex.props(styles.previewSidebar, styles.fill(colors.sidebar), styles.edge(colors.border))}>
				<span {...stylex.props(styles.previewAccent, styles.fill(colors.accent))} />
				{bar}
				{bar}
			</span>
			<span {...stylex.props(styles.previewContent)}>
				<span {...stylex.props(styles.previewBar, styles.fill(colors.bar), styles.width('75%'))} />
				<span {...stylex.props(styles.previewBar, styles.fill(colors.bar), styles.width('50%'))} />
				<span {...stylex.props(styles.previewButton, styles.fill(colors.primary))} />
			</span>
		</span>
	);
}

export function ThemeSwatch({ colors }: { colors: ThemePreviewColors }) {
	return (
		<span
			aria-hidden="true"
			{...stylex.props(styles.swatch, styles.edge(colors.border), styles.gradient(...colors.swatch))}
		/>
	);
}
