import type { Samples } from '@/data/samples';

/** Every time any of `sources` has a sample at, in order and without repeats, these are the table's rows */
export function mergeTimes(sources: readonly Samples[]): Float64Array {
	const merged = new Float64Array(sources.reduce((sum, samples) => sum + samples.length, 0));
	let length = 0;
	const next = sources.map(() => 0);
	for (;;) {
		// Pick the earliest next sample, there are usually only a few sources
		let time = Infinity;
		for (const [source, samples] of sources.entries()) {
			if (next[source]! < samples.length) {
				time = Math.min(time, samples.timestamps[next[source]!]!);
			}
		}
		if (time === Infinity) {
			return merged.slice(0, length);
		}
		merged[length++] = time;
		for (const [source, samples] of sources.entries()) {
			while (next[source]! < samples.length && samples.timestamps[next[source]!] === time) {
				next[source]!++;
			}
		}
	}
}

/** How many of the sorted `times` are at or before `time` */
export function countAtOrBefore(times: Float64Array, time: number): number {
	let low = 0;
	let high = times.length;
	while (low < high) {
		const middle = (low + high) >>> 1;
		if (times[middle]! <= time) {
			low = middle + 1;
		} else {
			high = middle;
		}
	}
	return low;
}
