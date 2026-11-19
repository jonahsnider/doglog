import {
	Blend,
	Contrast as MaterialContrast,
	DynamicScheme,
	Hct,
	TonalPalette,
	Variant,
	argbFromHex,
	hexFromArgb,
} from '@material/material-color-utilities';
import { chartCount, type Contrast, type ThemePreset } from '@/theme/choices';

/** Team 581 maroon, the hard-coded `--md-*` colors in `index.css` are generated from it */
export const defaultThemeColor = '#591616';

/** Default for the Custom preset, `hsl(20deg 12% 9.8%)` */
export const defaultCustomColor = '#1c1816';

/** MD3 contrast levels matching the Material Theme Builder's options */
const contrastLevels: Record<Contrast, number> = {
	standard: 0,
	medium: 0.5,
	high: 1,
};

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

function schemeColors(
	themeColor: string,
	dark: boolean,
	contrast: Contrast,
	preset: ThemePreset,
): (role: (typeof roles)[number]) => number {
	const sourceColorHct = Hct.fromInt(argbFromHex(presetColors[preset] ?? themeColor));
	const colors = new DynamicScheme({
		sourceColorHct,
		variant: Variant.TONAL_SPOT,
		contrastLevel: contrastLevels[contrast],
		isDark: dark,
		specVersion: '2025',
		...(preset === 'team581' && {
			neutralPalette: TonalPalette.fromHueAndChroma(sourceColorHct.hue, 2),
			neutralVariantPalette: TonalPalette.fromHueAndChroma(sourceColorHct.hue, 3.5),
		}),
		...(preset === 'match13' && {
			// Match match13.com's blue accents, icy light panels, and the black overlays on its dark data pages.
			primaryPalette: TonalPalette.fromInt(argbFromHex(dark ? '#6ab0fd' : '#135ab0')),
			secondaryPalette: TonalPalette.fromInt(argbFromHex(dark ? '#273e55' : '#cddff8')),
			neutralPalette: TonalPalette.fromInt(argbFromHex(dark ? '#000000' : '#e2efff')),
		}),
	});
	if (preset !== 'match13' || !dark) {
		return (role) => colors[role];
	}

	// Keep match13.com's sky-400 for actions and focus instead of Tonal Spot's pastel tone 80.
	const sky = TonalPalette.fromInt(argbFromHex('#29a3f6'));
	const tone = contrast === 'standard' ? sky.keyColor.tone : contrast === 'medium' ? 75 : 90;
	const ratio = contrast === 'standard' ? 6 : contrast === 'medium' ? 7 : 11;
	const primary = sky.tone(tone);
	const overrides: Partial<Record<(typeof roles)[number], number>> = {
		primary,
		surfaceTint: primary,
		onPrimary: sky.tone(MaterialContrast.darkerUnsafe(tone, ratio)),
	};
	return (role) => overrides[role] ?? colors[role];
}

/**
 * Generate chart colors for a theme color as `--chart-*` CSS variable declarations.
 * They share one HCT tone so every color contrasts equally with the background, only the hue changes.
 */
export function chartColorVariables(themeColor: string, dark: boolean): string {
	const { hue } = Hct.fromInt(argbFromHex(themeColor));
	return Array.from(
		{ length: chartCount },
		(_, index) =>
			`--chart-${index + 1}:${hexFromArgb(Hct.from((hue + (index * 360) / chartCount) % 360, 60, dark ? 72 : 48).toInt())};`,
	).join('');
}

/**
 * Status colors keep their meaning, so like MD3 custom colors they start from a fixed hue that's only nudged toward the theme
 * color's. Warning isn't nudged, like MD3's error: amber turns orange next to red themes, close to the error color, and
 * chartreuse next to green or blue ones.
 */
const statuses = ['success', 'info', 'warning', 'test-mode'] as const;
export type Status = (typeof statuses)[number];
const statusColors: Record<Status, string> = {
	success: '#10b981',
	info: '#3b82f6',
	warning: '#f59e0b',
	'test-mode': '#8b5cf6',
};

export function statusPalette(status: Status, themeColor: string): TonalPalette {
	const color = argbFromHex(statusColors[status]);
	return TonalPalette.fromInt(status === 'warning' ? color : Blend.harmonize(color, argbFromHex(themeColor)));
}

/**
 * Generate status colors for a theme color as CSS variable declarations, ex. `--success` for fills and icons and
 * `--success-foreground` for text. Warning fills are lighter since yellows only look yellow when they're light.
 */
export function statusColorVariables(themeColor: string, dark: boolean): string {
	return statuses
		.map((status) => {
			const palette = statusPalette(status, themeColor);
			const fillTone = status === 'warning' ? 75 : dark ? 70 : 60;
			const fill = `--${status}:${hexFromArgb(palette.tone(fillTone))};`;
			return status === 'test-mode'
				? fill
				: `${fill}--${status}-foreground:${hexFromArgb(palette.tone(dark ? 80 : 40))};`;
		})
		.join('');
}

/** Generate the preset's MD3 tonal spot scheme (2025 spec) as `--md-*` CSS variable declarations */
export function themeColorVariables(
	themeColor: string,
	dark: boolean,
	contrast: Contrast,
	preset: ThemePreset,
): string {
	const color = schemeColors(themeColor, dark, contrast, preset);
	return roles
		.map(
			(role) =>
				`--md-${role.replaceAll(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)}:${hexFromArgb(color(role))};`,
		)
		.join('');
}

/**
 * Stylesheet that overrides the default colors in `index.css` with ones generated from the theme color.
 * The doubled selectors win over `:root` and `.dark` in `index.css` regardless of which stylesheet loads last.
 */
function themeColorCss(themeColor: string, contrast: Contrast, preset: ThemePreset): string {
	const seed = presetColors[preset] ?? themeColor;
	const light =
		themeColorVariables(themeColor, false, contrast, preset) +
		chartColorVariables(seed, false) +
		statusColorVariables(seed, false);
	const dark =
		themeColorVariables(themeColor, true, contrast, preset) +
		chartColorVariables(seed, true) +
		statusColorVariables(seed, true);
	return `:root:root{${light}}:root.dark{${dark}}`;
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

export function themePreviewColors(
	preset: ThemePreset,
	themeColor: string,
	dark: boolean,
	contrast: Contrast,
): ThemePreviewColors {
	if (preset === 'coss') {
		return neutralPreviewColors[dark ? 'dark' : 'light'];
	}
	const color = schemeColors(themeColor, dark, contrast, preset);
	return {
		surface: hexFromArgb(color('surface')),
		sidebar: hexFromArgb(color('surfaceContainerLow')),
		bar: hexFromArgb(color('surfaceContainerHighest')),
		border: hexFromArgb(color('outlineVariant')),
		primary: hexFromArgb(color('primary')),
		accent: hexFromArgb(color('primaryContainer')),
	};
}

/** Color that theme-tinted widget colors, ex. graph bands, take their hue from. Neutral uses Tailwind's blue-500 */
export function accentColor(preset: ThemePreset, themeColor: string): string {
	return preset === 'coss' ? '#3b82f6' : (presetColors[preset] ?? themeColor);
}

/** `index.html` applies the cached stylesheet from this key before render to avoid a flash of the default colors, keep them in sync */
const cssStorageKey = 'doglog-studio:theme-color-css';

/** Apply a preset and cache generated colors for `index.html` to use on the next load, Neutral ignores the contrast */
export function applyThemeColor(themeColor: string, preset: ThemePreset, contrast: Contrast): void {
	document.documentElement.classList.toggle('coss-theme', preset === 'coss');
	const css = preset === 'coss' ? '' : themeColorCss(themeColor, contrast, preset);

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
