import { Hct, TonalPalette, argbFromHex, hexFromArgb } from '@material/material-color-utilities';
import type { Entry } from '@/data/data-store';
import { statusPalette } from '@/theme/status-color';

/** Every band color is light enough for black text, at HCT tone 70 black text has a contrast ratio of about 9:1 */
export const bandTextColor = '#000000';

const paletteSize = 10;
const bandTone = 70;

export type BandPalette = { values: string[]; true: string; false: string };

/**
 * Band colors derived from `accentColor`, sharing one HCT tone so they stand out equally on light and dark backgrounds.
 * String values get hues spaced evenly around the hue wheel starting from `accentColor`'s, true is the success color, and
 * false is a near-gray tinted with `accentColor`.
 */
export function bandPalette(accentColor: string): BandPalette {
	const { hue } = Hct.fromInt(argbFromHex(accentColor));
	return {
		// Stepping 3/10 of a turn visits all 10 hues while keeping consecutive colors far apart
		values: Array.from({ length: paletteSize }, (_, index) =>
			hexFromArgb(Hct.from((hue + index * 108) % 360, 48, bandTone).toInt()),
		),
		true: hexFromArgb(statusPalette('success', accentColor).tone(bandTone)),
		false: hexFromArgb(TonalPalette.fromHueAndChroma(hue, 6).tone(bandTone)),
	};
}

/** String values get palette colors in the order they're first seen, so each distinct value has its own color */
export type ColorAssignments = Map<Entry, Map<string, number>>;

export function bandColor(assignments: ColorAssignments, palette: BandPalette, entry: Entry, value: unknown): string;
export function bandColor(
	assignments: ColorAssignments,
	palette: BandPalette,
	entry: Entry,
	value: unknown,
	mode: 'lookup',
): string | undefined;
export function bandColor(
	assignments: ColorAssignments,
	palette: BandPalette,
	entry: Entry,
	value: unknown,
	mode?: 'lookup',
): string | undefined {
	if (typeof value === 'boolean') {
		return value ? palette.true : palette.false;
	}

	const text = String(value);
	let colors = assignments.get(entry);
	let index = colors?.get(text);
	if (mode === 'lookup' && index === undefined) {
		return undefined;
	}
	if (!colors) {
		colors = new Map();
		assignments.set(entry, colors);
	}
	if (index === undefined) {
		index = colors.size;
		colors.set(text, index);
	}
	return palette.values[index % palette.values.length]!;
}
