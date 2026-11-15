import type { Samples } from '@/data/samples';

/** Console messages in time order, `times[i]` (µs) is the time of `texts[i]` */
export type ConsoleMessages = {
	readonly times: Float64Array;
	readonly texts: readonly string[];
};

/** Merge the samples of string entries into one time-ordered list. Messages at the same time keep the order of `sources`. */
export function mergeMessages(sources: readonly Samples[]): ConsoleMessages {
	const total = sources.reduce((sum, samples) => sum + samples.length, 0);
	const times = new Float64Array(total);
	const texts: string[] = [];
	const next = sources.map(() => 0);

	for (let i = 0; i < total; i++) {
		// Pick the source with the earliest next message, there are usually only 1 or 2 sources
		let best = -1;
		for (const [source, samples] of sources.entries()) {
			if (next[source]! < samples.length && (best === -1 || samples.timestamps[next[source]!]! < times[i]!)) {
				best = source;
				times[i] = samples.timestamps[next[source]!]!;
			}
		}
		texts.push(sources[best]!.values[next[best]!] as string);
		next[best]!++;
	}

	return { times, texts };
}

/** Messages containing `query`, ignoring case */
export function filterMessages(messages: ConsoleMessages, query: string): ConsoleMessages {
	const needle = query.toLowerCase();
	const times: number[] = [];
	const texts: string[] = [];

	for (const [i, text] of messages.texts.entries()) {
		if (text.toLowerCase().includes(needle)) {
			times.push(messages.times[i]!);
			texts.push(text);
		}
	}

	return { times: Float64Array.from(times), texts };
}

/** How many messages are at or before `time` */
export function countAtOrBefore(messages: ConsoleMessages, time: number): number {
	let low = 0;
	let high = messages.texts.length;
	while (low < high) {
		const middle = (low + high) >>> 1;
		if (messages.times[middle]! <= time) {
			low = middle + 1;
		} else {
			high = middle;
		}
	}
	return low;
}
