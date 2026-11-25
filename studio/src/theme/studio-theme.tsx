import { Theme, defineTheme } from '@astryxdesign/core/theme';
import { useSelector } from '@tanstack/react-store';
import type { ReactNode } from 'react';
import { colorModeStore } from '@/settings';
import { studioIcons } from '@/theme/studio-icons';
import { team581Theme } from '@/theme/team581-theme';
import { liftVariable, liftedParts, themeColorTokenNames, themeColorVariable } from '@/theme/theme-color';

/**
 * Team 581's theme with colors generated for the theme color setting, applied as CSS variables that already switch with
 * the color mode, see `applyThemeColor()` in `@/theme/theme-color`. Presets, contrast levels, and custom colors restyle
 * every component without redefining the theme.
 */
const studioTheme = defineTheme({
	name: 'doglog-studio',
	extends: team581Theme,
	icons: studioIcons,
	tokens: {
		...Object.fromEntries(themeColorTokenNames.map((token) => [token, `var(${themeColorVariable(token)})`])),
		// Studio is a dense desktop app, so small controls match its 24px toolbar buttons
		'--size-element-sm': '24px',
	},
	components: Object.fromEntries(
		Object.entries(liftedParts).map(([part, styles]) => [
			part,
			Object.fromEntries(
				styles.map((style) => {
					// Per mode, to replace the Team 581 palette's lifts rather than lose to them
					const lift = { '--color-text-secondary': `var(${liftVariable(part, style)})` };
					return [style, { '@light': lift, '@dark': lift }];
				}),
			),
		]),
	),
});

/** Provides the Astryx theme in the color mode from the theme setting */
export function StudioTheme({ children }: { children: ReactNode }) {
	const mode = useSelector(colorModeStore);
	return (
		<Theme theme={studioTheme} mode={mode}>
			{children}
		</Theme>
	);
}
