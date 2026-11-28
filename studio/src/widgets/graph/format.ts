import type { Entry, TimeRange } from '@/data/data-store';
import { formatValue } from '@/data/format-value';
import type { Value } from '@/data/samples';
import type { SeriesUnit } from '@/widgets/graph/axis-units';

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

/** Most loops worth counting, longer ranges are only labeled with their duration */
const MAX_LOOPS = 100;

/**
 * About how many robot loops passed across `range`, ex. `3 loops`, or `undefined` when there are too many to be useful.
 * Counted as the samples after the start up to the end of the most often logged entry, which is likely logged every loop.
 */
export function loopsAcross(entries: readonly Entry[], range: TimeRange): string | undefined {
	let loops: number | undefined;
	for (const { samples } of entries) {
		if (samples.length > 0) {
			loops = Math.max(loops ?? 0, samples.indexAtOrBefore(range.end) - samples.indexAtOrBefore(range.start));
		}
	}
	if (loops === undefined || loops > MAX_LOOPS) {
		return undefined;
	}
	return `${loops} ${loops === 1 ? 'loop' : 'loops'}`;
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
