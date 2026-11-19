import type { Entry, TimeRange } from '@/data/data-store';
import { formatValue } from '@/data/format-value';
import type { Value } from '@/data/samples';
import type { SeriesUnit } from '@/widgets/graph/axis-units';

/** A duration in seconds, ex. `1.50 s`, with more decimals for short ones */
export function formatDuration(microseconds: number): string {
	const seconds = microseconds / 1_000_000;
	return `${seconds.toFixed(seconds < 0.1 ? 3 : 2)} s`;
}

function withUnit(text: string, unit: SeriesUnit): string {
	return unit.label === undefined ? text : `${text} ${unit.label}`;
}

/** A value in the unit it's plotted in, ex. `1.25 m/s` */
export function formatInUnit(value: Value, unit: SeriesUnit): string {
	if (typeof value !== 'number') {
		return formatValue(value);
	}
	// Converted values get long decimals, ex. 3.2808398950131235 ft
	return withUnit(formatValue(Number(unit.convert(value).toPrecision(6))), unit);
}

/** How much a numeric entry changed across `range` in the unit it's plotted in, ex. `+1.24 m` */
export function changeAcross(entry: Entry, range: TimeRange, unit: SeriesUnit): string | undefined {
	const start = entry.samples.valueAt(range.start);
	const end = entry.samples.valueAt(range.end);
	if (typeof start !== 'number' || typeof end !== 'number') {
		return undefined;
	}
	const change = unit.convert(end) - unit.convert(start);
	return withUnit(`${change > 0 ? '+' : ''}${formatValue(Number(change.toPrecision(6)))}`, unit);
}
