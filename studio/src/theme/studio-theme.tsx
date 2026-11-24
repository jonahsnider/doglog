import { Theme, defineTheme } from '@astryxdesign/core/theme';
import { useSelector } from '@tanstack/react-store';
import type { ReactNode } from 'react';
import { colorModeStore } from '@/settings';
import { type Team581Role, team581ColorTokens, team581Theme } from '@/theme/team581-theme';

/** Roles Studio generates as `--<role>` instead of `--md-<role>`, see `statusColorVariables()` in `@/theme/status-color` */
const statusRoles = new Set<Team581Role>([
	'success',
	'success-foreground',
	'info',
	'info-foreground',
	'warning',
	'warning-foreground',
]);

const color = (role: Team581Role) => `var(--${statusRoles.has(role) ? '' : 'md-'}${role})`;

/**
 * Team 581's theme with colors from the scheme Studio generates for the theme color setting, applied as CSS variables
 * that already switch with the color mode, see `applyThemeColor()` in `@/theme/theme-color`. Presets, contrast levels,
 * and custom colors restyle every component without redefining the theme.
 */
const studioTheme = defineTheme({
	name: 'doglog-studio',
	extends: team581Theme,
	tokens: {
		...team581ColorTokens(color),
		// Studio is a dense desktop app, so small controls match its 24px toolbar buttons
		'--size-element-sm': '24px',
	},
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
