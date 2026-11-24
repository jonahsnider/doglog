import { formatValue } from '@/data/format-value';
import type { Bin } from '@/widgets/histogram/data';

/** Space after the value axis, wide enough for its last label and then its unit */
export function valueAxisEnd(unit: string | undefined): number {
	if (unit === undefined) {
		return 12;
	}
	const context = document.createElement('canvas').getContext('2d')!;
	context.font = `12px ${getComputedStyle(document.body).fontFamily}`;
	return 12 + Math.ceil(context.measureText(unit).width) + 6;
}

export function binValues(bin: Bin, unit: string | undefined, separator: string): string {
	let start = formatValue(bin.start);
	let end = formatValue(bin.end);
	if (start === end && bin.start !== bin.end) {
		start = String(bin.start);
		end = String(bin.end);
	}
	const values = start === end ? start : `${start}${separator}${end}`;
	return unit === undefined ? values : `${values} ${unit}`;
}

/** A count and its share of the series' samples, ex. `3 samples (25%)` */
export function binCount(count: number, total: number): string {
	const percent = formatValue(Number(((count / total) * 100).toPrecision(3)));
	return `${count.toLocaleString()} ${count === 1 ? 'sample' : 'samples'} (${percent}%)`;
}

export type PlotSeries = { id: string; name: string; color: string; total: number };

export function binLabel(bin: Bin, unit: string | undefined, series: readonly PlotSeries[], last: boolean): string {
	const bounds = bin.start !== bin.end && !last ? ' (upper edge excluded)' : '';
	const counts = series.map(
		(item, index) => `${series.length > 1 ? `${item.name} ` : ''}${binCount(bin.counts[index]!, item.total)}`,
	);
	return `${binValues(bin, unit, ' to ')}${bounds}: ${counts.join(', ')}`;
}
