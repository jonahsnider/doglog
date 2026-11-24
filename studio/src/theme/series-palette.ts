import { Hct, argbFromHex, hexFromArgb } from '@material/material-color-utilities';
import type { VisualizationPalette } from '@/theme/choices';

// Fixed light and dark palettes checked under color vision simulation.
// Don't harmonize them with the theme: it could bring two colors closer together again.
export const seriesPaletteColors = {
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
} satisfies Record<Exclude<VisualizationPalette, 'default'>, Record<'light' | 'dark', readonly string[]>>;

/** Pick a Material 3 tonal palette step at least one 10-tone step away from the fill. */
export function seriesOutlineVariable(slot: number, color: string): string {
	const { hue, chroma, tone } = Hct.fromInt(argbFromHex(color));
	// Go lighter below tone 20 so the outline doesn't collapse to tone 0 (black).
	const outlineTone = tone < 20 ? 10 * Math.ceil(tone / 10 + 1) : 10 * Math.floor(tone / 10 - 1);
	return `--series-outline-${slot}:${hexFromArgb(Hct.from(hue, chroma, outlineTone).toInt())};`;
}

/** Override widget series colors only; Default uses the theme colors defined in index.css. */
export function seriesPaletteVariables(palette: VisualizationPalette, dark: boolean): string {
	return palette === 'default'
		? ''
		: seriesPaletteColors[palette][dark ? 'dark' : 'light']
				.map((color, index) => `--series-${index + 1}:${color};${seriesOutlineVariable(index + 1, color)}`)
				.join('');
}
