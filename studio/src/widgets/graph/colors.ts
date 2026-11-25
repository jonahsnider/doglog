import type { Entry } from '@/data/data-store';
import { categoricalColors, dataColor, shade } from '@/theme/series-palette';
import { statusSeeds } from '@/theme/team581-colors';

/** Every band color is light enough for black text, at stop 70 black text has a contrast ratio of about 9:1 */
export const bandTextColor = '#000000';

const bandStop = 70;

export type BandPalette = { values: string[]; true: string; false: string };

/**
 * Band colors from Astryx's data colors, sharing one stop so they stand out equally on light and dark backgrounds. String
 * values get the categorical colors in order, true is the success color, and false is the data neutral.
 */
export const bandPalette: BandPalette = {
	values: categoricalColors.map((name) => shade(dataColor(`categorical-${name}`, false), bandStop)),
	true: shade(statusSeeds.success, bandStop),
	false: shade(dataColor('neutral', false), bandStop, true),
};

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
