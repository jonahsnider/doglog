import { generateTonalPalette } from '@astryxdesign/core/palette';
import { resolveThemeTokens } from '@astryxdesign/core/theme/tokens';
import { chartCount, type VisualizationPalette } from '@/theme/choices';

const dataColors = {
	light: resolveThemeTokens(null, { mode: 'light' }),
	dark: resolveThemeTokens(null, { mode: 'dark' }),
};

/** Astryx's categorical data colors, in its order */
export const categoricalColors = [
	'blue',
	'orange',
	'purple',
	'green',
	'pink',
	'cyan',
	'red',
	'teal',
	'brown',
	'indigo',
] as const;

/** An Astryx data color, ex. `categorical-blue`, as `#rrggbb` */
export const dataColor = (name: string, dark: boolean) =>
	dataColors[dark ? 'dark' : 'light'][`--color-data-${name}`]!.toLowerCase();

/**
 * Astryx's categorical order, leaving out colors under 3:1 against light or dark panes (purple, cyan, and brown) and red,
 * which reads as an error
 */
const defaultSeries = ['blue', 'orange', 'green', 'pink', 'teal'] as const;

// Fixed light and dark palettes checked under color vision simulation.
// Don't harmonize them with the theme: it could bring two colors closer together again.
export const seriesPaletteColors = {
	default: {
		light: defaultSeries.map((name) => dataColor(`categorical-${name}`, false)),
		dark: defaultSeries.map((name) => dataColor(`categorical-${name}`, true)),
	},
	protan: {
		light: ['#a124ff', '#2d4d00', '#778a00', '#6d1e84', '#9e6894'],
		dark: ['#b055ff', '#8de200', '#798c00', '#fee2ff', '#ce93c2'],
	},
	// Chrome's deuteranopia emulation reduces these to two blues, two golden browns, and a neutral.
	// Give each same-hue pair a light and a dark member; the neutral stays out of both groups.
	deutan: {
		light: ['#692d00', '#4b78ff', '#b46900', '#0f0f0f', '#0000a5'],
		dark: ['#4b871e', '#0fd2ff', '#ffb400', '#f0f0f0', '#0078f0'],
	},
	tritan: {
		light: ['#e82cae', '#00961b', '#8f000d', '#00510a', '#8f00eb'],
		dark: ['#ffe4ef', '#00991c', '#f53c39', '#3dea45', '#c98bff'],
	},
} satisfies Record<VisualizationPalette, Record<'light' | 'dark', readonly string[]>>;

/** CIE lightness (0 to 100) of a `#rrggbb` color, which the stops of Astryx's ramps follow */
function lightness(color: string): number {
	const [red, green, blue] = [1, 3, 5].map((index) => {
		const channel = Number.parseInt(color.slice(index, index + 2), 16) / 255;
		return channel <= 0.040_45 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
	});
	const luminance = 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
	return luminance > 216 / 24_389 ? 116 * Math.cbrt(luminance) - 16 : (luminance * 24_389) / 27;
}

/**
 * A shade of a color from the Astryx ramp grown from it, by stop: 0 is black, 100 is white. Grays and `neutral` colors
 * grow a neutral ramp, which keeps their tint instead of taking on a hue.
 */
export function shade(color: string, stop: number, neutral = /^#(\w\w)\1\1$/u.test(color)): string {
	return generateTonalPalette({
		recipe: 'astryx-oklch-v2',
		modeStrategy: 'light-only',
		...(neutral ? { neutralProfile: 'custom' } : {}),
		families: [{ id: 'color', seed: color, ...(neutral ? { kind: 'neutral' } : {}) }],
	}).palette['color']!.light![stop]!;
}

/** A darker shade two stops from a series fill, or lighter for fills near black, so outlines don't collapse to black */
export function seriesOutline(color: string): string {
	const stop = Math.round(lightness(color) / 5) * 5;
	return shade(color, stop <= 20 ? stop + 10 : stop - 10);
}

/** The visualization palette's series fills and outlines as CSS variable declarations */
export function seriesPaletteVariables(palette: VisualizationPalette, dark: boolean): string {
	return seriesPaletteColors[palette][dark ? 'dark' : 'light']
		.slice(0, chartCount)
		.map((color, index) => `--series-${index + 1}:${color};--series-outline-${index + 1}:${seriesOutline(color)};`)
		.join('');
}
