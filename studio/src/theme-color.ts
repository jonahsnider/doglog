import { Hct, SchemeTonalSpot, argbFromHex, hexFromArgb } from '@material/material-color-utilities';

/** Team 581 maroon, the hard-coded `--md-*` colors in `index.css` are generated from it */
export const defaultThemeColor = '#591616';

/** Default for the Custom preset, `hsl(20deg 12% 9.8%)` */
export const defaultCustomColor = '#1c1816';

export const themePresets = ['team581', 'match13', 'coss', 'custom'] as const;
export type ThemePreset = (typeof themePresets)[number];

/** Colors that presets generate their color scheme from, match13's is the `theme-color` from match13.com */
const presetColors: Partial<Record<ThemePreset, string>> = {
	team581: defaultThemeColor,
	match13: '#1a7ccd',
};

/** MD3 color roles applied as `--md-*` CSS variables, ex. `surfaceContainerLow` is `--md-surface-container-low` */
const roles = [
	'primary',
	'surfaceTint',
	'onPrimary',
	'primaryContainer',
	'onPrimaryContainer',
	'secondary',
	'onSecondary',
	'secondaryContainer',
	'onSecondaryContainer',
	'tertiary',
	'onTertiary',
	'tertiaryContainer',
	'onTertiaryContainer',
	'error',
	'onError',
	'errorContainer',
	'onErrorContainer',
	'background',
	'onBackground',
	'surface',
	'onSurface',
	'surfaceVariant',
	'onSurfaceVariant',
	'outline',
	'outlineVariant',
	'shadow',
	'scrim',
	'inverseSurface',
	'inverseOnSurface',
	'inversePrimary',
	'primaryFixed',
	'onPrimaryFixed',
	'primaryFixedDim',
	'onPrimaryFixedVariant',
	'secondaryFixed',
	'onSecondaryFixed',
	'secondaryFixedDim',
	'onSecondaryFixedVariant',
	'tertiaryFixed',
	'onTertiaryFixed',
	'tertiaryFixedDim',
	'onTertiaryFixedVariant',
	'surfaceDim',
	'surfaceBright',
	'surfaceContainerLowest',
	'surfaceContainerLow',
	'surfaceContainer',
	'surfaceContainerHigh',
	'surfaceContainerHighest',
] as const;

/** Generate the MD3 tonal spot scheme for a theme color as `--md-*` CSS variable declarations */
export function themeColorVariables(themeColor: string, dark: boolean): string {
	const scheme = new SchemeTonalSpot(Hct.fromInt(argbFromHex(themeColor)), dark, 0);
	return roles
		.map(
			(role) =>
				`--md-${role.replaceAll(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)}:${hexFromArgb(scheme[role])};`,
		)
		.join('');
}

/**
 * Stylesheet that overrides the default colors in `index.css` with ones generated from the theme color.
 * The doubled selectors win over `:root` and `.dark` in `index.css` regardless of which stylesheet loads last.
 */
function themeColorCss(themeColor: string): string {
	return `:root:root{${themeColorVariables(themeColor, false)}}:root.dark{${themeColorVariables(themeColor, true)}}`;
}

/** Colors used to draw a preview of a theme in Settings */
export interface ThemePreviewColors {
	surface: string;
	sidebar: string;
	bar: string;
	border: string;
	primary: string;
	accent: string;
}

/** Approximations of the `.coss-theme` tokens in `index.css` */
const neutralPreviewColors: Record<'light' | 'dark', ThemePreviewColors> = {
	light: {
		surface: '#ffffff',
		sidebar: '#fafafa',
		bar: '#f0f0f0',
		border: '#ebebeb',
		primary: '#262626',
		accent: '#e5e5e5',
	},
	dark: {
		surface: '#161616',
		sidebar: '#111111',
		bar: '#262626',
		border: '#222222',
		primary: '#f5f5f5',
		accent: '#404040',
	},
};

export function themePreviewColors(preset: ThemePreset, themeColor: string, dark: boolean): ThemePreviewColors {
	if (preset === 'coss') {
		return neutralPreviewColors[dark ? 'dark' : 'light'];
	}
	const seed = presetColors[preset] ?? themeColor;
	const scheme = new SchemeTonalSpot(Hct.fromInt(argbFromHex(seed)), dark, 0);
	return {
		surface: hexFromArgb(scheme.surface),
		sidebar: hexFromArgb(scheme.surfaceContainerLow),
		bar: hexFromArgb(scheme.surfaceContainerHighest),
		border: hexFromArgb(scheme.outlineVariant),
		primary: hexFromArgb(scheme.primary),
		accent: hexFromArgb(scheme.primaryContainer),
	};
}

/** `index.html` applies the cached stylesheet from this key before render to avoid a flash of the default colors, keep them in sync */
const cssStorageKey = 'doglog-studio:theme-color-css';

/** Apply a preset and cache generated colors for `index.html` to use on the next load */
export function applyThemeColor(themeColor: string, preset: ThemePreset): void {
	document.documentElement.classList.toggle('coss-theme', preset === 'coss');
	const css = preset === 'coss' ? '' : themeColorCss(presetColors[preset] ?? themeColor);

	// `index.html` may have added this element already
	let style = document.querySelector<HTMLStyleElement>('#theme-color');
	if (style === null) {
		style = document.createElement('style');
		style.id = 'theme-color';
		document.head.append(style);
	}
	style.textContent = css;

	try {
		localStorage.setItem(cssStorageKey, css);
	} catch {
		// Storage can be full or disabled, the colors just flash on the next load
	}
}
