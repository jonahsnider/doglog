import type { TimeRange } from '@/data/data-store';

/** Tick spacings (µs): fractions of a second, then seconds and minutes */
const spacings = [
	...[1, 2, 5, 10, 20, 50, 100, 200, 500].map((milliseconds) => milliseconds * 1000),
	...[1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800].map((seconds) => seconds * 1_000_000),
];

/** Times (µs) to label on a time axis `pixels` wide, at least `minPixels` apart, aligned to the start of the source */
export function timeTicks(
	view: TimeRange,
	start: number,
	pixels: number,
	minPixels = 80,
): { times: number[]; spacing: number } {
	const width = view.end - view.start;
	const spacing = spacings.find((value) => (value / width) * pixels >= minPixels) ?? spacings.at(-1)!;
	const times: number[] = [];
	for (let tick = start + Math.ceil((view.start - start) / spacing) * spacing; tick <= view.end; tick += spacing) {
		times.push(tick);
	}
	return { times, spacing };
}

/** A tick's label, minutes and seconds since the start of the source with only the decimals its spacing needs, ex. `1:05` or `0:02.5` */
export function formatTick(time: number, start: number, spacing: number): string {
	const decimals = spacing >= 1_000_000 ? 0 : spacing >= 100_000 ? 1 : spacing >= 10_000 ? 2 : 3;
	const totalSeconds = (time - start) / 1_000_000;
	const rounded = Number(totalSeconds.toFixed(decimals));
	const minutes = Math.floor(rounded / 60);
	const seconds = (rounded - minutes * 60).toFixed(decimals).padStart(decimals === 0 ? 2 : decimals + 3, '0');
	return `${minutes}:${seconds}`;
}
