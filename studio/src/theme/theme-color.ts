import {
	Contrast as MaterialContrast,
	DynamicScheme,
	Hct,
	TonalPalette,
	Variant,
	argbFromHex,
	hexFromArgb,
} from '@material/material-color-utilities';
import { chartCount, type Contrast, type ThemePreset } from '@/theme/choices';
import { statusColorVariables } from '@/theme/status-color';

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

/**
 * Colors that presets generate their color scheme from, match13's is the `theme-color` from match13.com. Neutral's
 * palettes are gray, so its blue only gives the series, status, and band colors a hue.
 */
const presetColors: Partial<Record<ThemePreset, string>> = {
	team581: defaultThemeColor,
	match13: '#1a7ccd',
	neutral: '#3b82f6',
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

type Role = (typeof roles)[number];
type Palettes = Pick<
	ConstructorParameters<typeof DynamicScheme>[0],
	'primaryPalette' | 'secondaryPalette' | 'neutralPalette' | 'neutralVariantPalette'
>;

const fromHex = (hex: string) => TonalPalette.fromInt(argbFromHex(hex));
const maroonHue = Hct.fromInt(argbFromHex(defaultThemeColor)).hue;
const gray = TonalPalette.fromHueAndChroma(0, 0);
const grayPalettes: Palettes = {
	primaryPalette: gray,
	secondaryPalette: gray,
	neutralPalette: gray,
	neutralVariantPalette: gray,
};

/** Palettes that presets use instead of Tonal Spot's in each appearance */
const presetPalettes: Partial<Record<ThemePreset, Record<'light' | 'dark', Palettes>>> = {
	// Muted neutrals so the team color stands out, lower in light mode where the 2025 spec boosts container chroma
	team581: {
		light: {
			neutralPalette: TonalPalette.fromHueAndChroma(maroonHue, 1),
			neutralVariantPalette: TonalPalette.fromHueAndChroma(maroonHue, 2),
		},
		dark: {
			neutralPalette: TonalPalette.fromHueAndChroma(maroonHue, 2),
			neutralVariantPalette: TonalPalette.fromHueAndChroma(maroonHue, 3.5),
		},
	},
	// match13.com's blue accents, icy light panels, and the black overlays on its dark data pages
	match13: {
		light: {
			primaryPalette: fromHex('#135ab0'),
			secondaryPalette: fromHex('#cddff8'),
			neutralPalette: fromHex('#e2efff'),
		},
		dark: {
			primaryPalette: fromHex('#6ab0fd'),
			secondaryPalette: fromHex('#273e55'),
			neutralPalette: fromHex('#000000'),
		},
	},
	// Untinted grays, so only status, series, and error colors have a hue
	neutral: { light: grayPalettes, dark: grayPalettes },
};

/** match13.com's sky-400 for dark mode actions and focus instead of Tonal Spot's pastel tone 80 */
const sky = fromHex('#29a3f6');
/** The sky tone for primary and its contrast ratio with on-primary at each contrast level */
const skyPrimary: Record<Contrast, { tone: number; onPrimaryRatio: number }> = {
	standard: { tone: sky.keyColor.tone, onPrimaryRatio: 6 },
	medium: { tone: 75, onPrimaryRatio: 7 },
	high: { tone: 90, onPrimaryRatio: 11 },
};

/** A preset's MD3 colors by role, as ARGB. Also draws link preview images, see `@/link-previews/preview-style`. */
export function schemeColors(
	themeColor: string,
	dark: boolean,
	contrast: Contrast,
	preset: ThemePreset,
): (role: Role) => number {
	const colors = new DynamicScheme({
		sourceColorHct: Hct.fromInt(argbFromHex(presetColors[preset] ?? themeColor)),
		variant: Variant.TONAL_SPOT,
		contrastLevel: contrastLevels[contrast],
		isDark: dark,
		specVersion: '2025',
		...presetPalettes[preset]?.[dark ? 'dark' : 'light'],
	});
	if (preset !== 'match13' || !dark) {
		return (role) => colors[role];
	}

	const { tone, onPrimaryRatio } = skyPrimary[contrast];
	const primary = sky.tone(tone);
	const overrides: Partial<Record<Role, number>> = {
		primary,
		surfaceTint: primary,
		onPrimary: sky.tone(MaterialContrast.darkerUnsafe(tone, onPrimaryRatio)),
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
	const variables = (dark: boolean) =>
		themeColorVariables(themeColor, dark, contrast, preset) +
		chartColorVariables(seed, dark) +
		statusColorVariables(seed, dark);
	return `:root:root{${variables(false)}}:root.dark{${variables(true)}}`;
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

export function themePreviewColors(
	preset: ThemePreset,
	themeColor: string,
	dark: boolean,
	contrast: Contrast,
): ThemePreviewColors {
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

/** Color that theme-tinted widget colors, ex. graph bands, take their hue from */
export function accentColor(preset: ThemePreset, themeColor: string): string {
	return presetColors[preset] ?? themeColor;
}

/** `index.html` applies the cached stylesheet from this key before render to avoid a flash of the default colors, keep them in sync */
const cssStorageKey = 'doglog-studio:theme-color-css';

/** Apply a preset and cache generated colors for `index.html` to use on the next load */
export function applyThemeColor(themeColor: string, preset: ThemePreset, contrast: Contrast): void {
	const css = themeColorCss(themeColor, contrast, preset);

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
