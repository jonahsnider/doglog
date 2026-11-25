import {
	type ThemePalette,
	type ThemePaletteInput,
	generateTonalPalette,
	themePalette,
} from '@astryxdesign/core/palette';
import type { ThemePreset, VisualizationPalette } from '@/theme/choices';
import { seriesPaletteVariables, shade } from '@/theme/series-palette';
import { statusSeeds, team581Seeds } from '@/theme/team581-colors';

/** Team 581 maroon, the Team 581 theme's accent */
export const defaultThemeColor = team581Seeds.accent;

/** Default for the Custom preset, `hsl(20deg 12% 9.8%)` */
export const defaultCustomColor = '#1c1816';

const frogLogGreen = '#79b748';

/** A gray with a color's hue and lightness, for a neutral seed: the color mixed most of the way to its own luminance */
function tintedGray(color: string): string {
	const [red, green, blue] = [1, 3, 5].map((index) => Number.parseInt(color.slice(index, index + 2), 16));
	const gray = 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
	const channel = (value: number) =>
		Math.round(gray + (value - gray) * 0.15)
			.toString(16)
			.padStart(2, '0');
	return `#${channel(red!)}${channel(green!)}${channel(blue!)}`;
}

const recipe = 'astryx-oklch-v2';

/** The seeds of each preset's Astryx palette in a color mode */
const presetSeeds: Record<ThemePreset, (themeColor: string, dark: boolean) => ThemePaletteInput> = {
	team581: () => team581Seeds,
	// match13.com's blue accents and icy panels in light mode, its sky-400 on black overlays in dark mode
	match13: (_, dark) =>
		dark
			? { accent: '#29a3f6', neutral: '#000000', ...statusSeeds, recipe }
			: { accent: '#135ab0', neutral: '#e2efff', ...statusSeeds, recipe },
	froglog: () => ({ accent: frogLogGreen, neutral: tintedGray(frogLogGreen), ...statusSeeds, recipe }),
	// Untinted grays, so only status, series, and error colors have a hue
	neutral: () => ({ accent: '#5e5e5e', neutral: '#6b6b6b', ...statusSeeds, recipe }),
	custom: (themeColor) => ({ accent: themeColor, neutral: tintedGray(themeColor), ...statusSeeds, recipe }),
};

/** Generated palettes by their seeds, since the settings' previews ask for every preset's on each render */
const palettes = new Map<string, ThemePalette>();
function cachedPalette(seeds: ThemePaletteInput): ThemePalette {
	const key = JSON.stringify(seeds);
	let palette = palettes.get(key);
	if (!palette) {
		// Dragging the custom color's picker makes a palette for each color it passes
		if (palettes.size > 32) {
			palettes.clear();
		}
		palette = themePalette(seeds);
		palettes.set(key, palette);
	}
	return palette;
}

/** FrogLog's soft stream blue, for selected items instead of a tint of its green */
const frogLogBlue = generateTonalPalette({
	recipe,
	modeStrategy: 'light-and-dark',
	families: [{ id: 'blue', seed: '#9ed8f7' }],
}).palette['blue']!;

/** WCAG relative luminance of a `#rrggbb` color */
function luminance(color: string): number {
	const [red, green, blue] = [1, 3, 5].map((index) => {
		const channel = Number.parseInt(color.slice(index, index + 2), 16) / 255;
		return channel <= 0.040_45 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}

/** WCAG contrast ratio of two `#rrggbb` colors */
function contrastRatio(a: string, b: string): number {
	const [light, dark] = [luminance(a), luminance(b)].toSorted((x, y) => y - x);
	return (light! + 0.05) / (dark! + 0.05);
}

/**
 * Make text, icons, and borders stronger on the palette's neutral ramp, as Astryx's tone-based color generator does
 * for high contrast: secondary text and icons 10 stops toward contrast, the translucent border twice as opaque, and the
 * emphasized border from mid-scale toward contrast until it reaches 3:1 on surfaces. Primary text is already black or
 * white.
 */
function applyHighContrast(tokens: Record<string, string>, neutralSeed: string, dark: boolean): void {
	const ramp: Record<number, string> = generateTonalPalette({
		recipe,
		neutralProfile: 'custom',
		modeStrategy: 'light-and-dark',
		families: [{ id: 'neutral', seed: neutralSeed, kind: 'neutral' }],
	}).palette['neutral']![dark ? 'dark' : 'light']!;
	const stops = Object.keys(ramp).map(Number);
	// Text darkens in light mode and lightens in dark mode
	const toward = dark ? 1 : -1;

	for (const token of ['--color-text-secondary', '--color-icon-secondary']) {
		// The palette generates its ramp with its other seeds, so it's close to this one but not always equal
		const distance = (stop: number) => Math.abs(luminance(ramp[stop]!) - luminance(tokens[token]!));
		const nearest = stops.reduce((closest, stop) => (distance(stop) < distance(closest) ? stop : closest));
		tokens[token] = ramp[Math.min(100, Math.max(0, nearest + 10 * toward))]!;
	}

	const border = tokens['--color-border']!;
	const alpha = Number.parseInt(border.slice(7), 16) * 2;
	tokens['--color-border'] = `${border.slice(0, 7)}${alpha.toString(16).padStart(2, '0')}`;

	const surfaces = [tokens['--color-background-body']!, tokens['--color-background-surface']!];
	const readable = (stop: number) => surfaces.every((surface) => contrastRatio(ramp[stop]!, surface) >= 3);
	let stop = 50;
	while (!readable(stop) && stop !== (dark ? 100 : 0)) {
		stop += 5 * toward;
	}
	tokens['--color-border-emphasized'] = ramp[stop]!;
}

export interface ThemeColors {
	/** Astryx color tokens */
	tokens: Record<string, string>;
	/** Secondary text on parts with tinted backgrounds, ex. selected items, by `part` and style key */
	lifts: Record<string, Record<string, string>>;
}

/** A preset's Astryx colors in a color mode, at standard or high contrast, generated from its seeds */
export function themeColors(
	themeColor: string,
	dark: boolean,
	highContrast: boolean,
	preset: ThemePreset,
): ThemeColors {
	const seeds = presetSeeds[preset](themeColor, dark);
	const palette = cachedPalette(seeds);
	const mode = dark ? 'dark' : 'light';
	const tokens = Object.fromEntries(
		Object.entries(palette.tokens).map(([token, values]) => [token, values[dark ? 1 : 0]]),
	);
	if (preset === 'froglog') {
		tokens['--color-accent-muted'] = frogLogBlue[mode]![dark ? 30 : 85]!;
	}
	if (highContrast) {
		applyHighContrast(tokens, seeds.neutral!, dark);
	}

	// Lifted text keeps its own contrast, unless high contrast made secondary text stronger still
	const secondary = tokens['--color-text-secondary']!;
	const stronger = (color: string) => (dark === luminance(color) > luminance(secondary) ? color : secondary);
	const lifts = Object.fromEntries(
		Object.entries(liftedParts).map(([part, styles]) => [
			part,
			Object.fromEntries(
				styles.map((style) => {
					const lift = palette.components[part]?.[style]?.[`@${mode}`]?.['--color-text-secondary'];
					return [style, typeof lift === 'string' ? stronger(lift) : secondary];
				}),
			),
		]),
	);
	return { tokens, lifts };
}

/** The color tokens every generated palette sets, which Studio's Astryx theme reads from CSS variables */
export const themeColorTokenNames = Object.keys(cachedPalette(team581Seeds).tokens);

/** The parts and style keys whose secondary text palettes lift */
export const liftedParts: Record<string, string[]> = Object.fromEntries(
	Object.entries(cachedPalette(team581Seeds).components).map(([part, styles]) => [part, Object.keys(styles)]),
);

/** The variable Studio's Astryx theme reads a generated color token from, ex. `--studio-color-accent` */
export const themeColorVariable = (token: string) => `--studio-${token.slice(2)}`;

/** The variable Studio's Astryx theme reads a part's lifted secondary text from, ex. `--studio-lift-item-selected` */
export const liftVariable = (part: string, style: string) => `--studio-lift-${part}-${style.replace(':', '-')}`;

const testModeSeed = '#8b5cf6';

/** Generate the preset's colors as CSS variable declarations, with test mode, which Astryx has no token for */
export function themeColorVariables(
	themeColor: string,
	dark: boolean,
	highContrast: boolean,
	preset: ThemePreset,
): string {
	const { tokens, lifts } = themeColors(themeColor, dark, highContrast, preset);
	return [
		...Object.entries(tokens).map(([token, value]) => `${themeColorVariable(token)}:${value};`),
		...Object.entries(lifts).flatMap(([part, styles]) =>
			Object.entries(styles).map(([style, value]) => `${liftVariable(part, style)}:${value};`),
		),
		// Lighter in dark mode, like Astryx's fills
		`--test-mode:${dark ? shade(testModeSeed, 70) : testModeSeed};`,
	].join('');
}

/**
 * Stylesheet with the colors generated for the color settings. High contrast also applies when the system asks for more
 * contrast, like Astryx's own contrast adaptations.
 */
function themeColorCss(
	themeColor: string,
	highContrast: boolean,
	preset: ThemePreset,
	visualizationPalette: VisualizationPalette,
): string {
	const variables = (dark: boolean, high: boolean) =>
		themeColorVariables(themeColor, dark, high, preset) + seriesPaletteVariables(visualizationPalette, dark);
	// Doubled selectors win over `index.css` regardless of which stylesheet loads last
	const css = (high: boolean) => `:root:root{${variables(false, high)}}:root.dark{${variables(true, high)}}`;
	return highContrast ? css(true) : `${css(false)}@media (prefers-contrast: more){${css(true)}}`;
}

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
	highContrast: boolean,
): ThemePreviewColors {
	const { tokens } = themeColors(themeColor, dark, highContrast, preset);
	return {
		surface: tokens['--color-background-surface']!,
		sidebar: tokens['--color-background-body']!,
		bar: tokens['--color-background-muted']!,
		border: tokens['--color-border']!,
		primary: tokens['--color-accent']!,
		accent: tokens['--color-accent-muted']!,
	};
}

/** `index.html` applies the cached stylesheet from this key before render to avoid a flash of the default colors, keep them in sync */
const cssStorageKey = 'doglog-studio:theme-color-css';

/** Apply a preset and cache generated colors for `index.html` to use on the next load */
export function applyThemeColor(
	themeColor: string,
	preset: ThemePreset,
	highContrast: boolean,
	visualizationPalette: VisualizationPalette,
): void {
	const css = themeColorCss(themeColor, highContrast, preset, visualizationPalette);

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
