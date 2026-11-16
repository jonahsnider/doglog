import type { Entry } from '@/data/data-store';

type BandColor = { fill: string; text: string };

/** Mid-tone colors that stand out on both light and dark backgrounds, with readable text on top */
const palette: readonly BandColor[] = [
	{ fill: '#3b82f6', text: '#ffffff' },
	{ fill: '#f59e0b', text: '#000000' },
	{ fill: '#8b5cf6', text: '#ffffff' },
	{ fill: '#10b981', text: '#000000' },
	{ fill: '#f43f5e', text: '#ffffff' },
	{ fill: '#22d3ee', text: '#000000' },
	{ fill: '#d946ef', text: '#ffffff' },
	{ fill: '#a3e635', text: '#000000' },
	{ fill: '#f97316', text: '#000000' },
	{ fill: '#0d9488', text: '#ffffff' },
];
const trueColor: BandColor = { fill: '#10b981', text: '#000000' };
const falseColor: BandColor = { fill: '#a1a1aa', text: '#000000' };

/** String values get palette colors in the order they're first seen, so each distinct value has its own color */
export type ColorAssignments = Map<Entry, Map<string, number>>;

export function bandColor(assignments: ColorAssignments, entry: Entry, value: unknown): BandColor {
	if (typeof value === 'boolean') {
		return value ? trueColor : falseColor;
	}

	let colors = assignments.get(entry);
	if (!colors) {
		colors = new Map();
		assignments.set(entry, colors);
	}
	const text = String(value);
	let index = colors.get(text);
	if (index === undefined) {
		index = colors.size;
		colors.set(text, index);
	}
	return palette[index % palette.length]!;
}
