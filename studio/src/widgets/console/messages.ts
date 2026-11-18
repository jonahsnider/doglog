import { formatValue } from '@/data/format-value';
import type { Samples } from '@/data/samples';

export const messageLevels = ['info', 'warning', 'error'] as const;
export type MessageLevel = (typeof messageLevels)[number];

/** Console messages in time order, `times[i]` (µs) is the time of `texts[i]`, `levels[i]` is its level, and `ids[i]` is its index in the merged messages */
export type ConsoleMessages = {
	readonly ids: Uint32Array;
	readonly times: Float64Array;
	readonly texts: readonly string[];
	readonly levels: readonly MessageLevel[];
};

/** Level of a message from its first line, using the prefixes WPILib prints for `DriverStation.reportError()`, `reportWarning()`, uncaught exceptions, and command scheduler overruns */
export function messageLevel(line: string): MessageLevel {
	if (line.startsWith('Error at ') || line.startsWith('Exception in thread ')) {
		return 'error';
	}
	if (line.startsWith('Warning at ') || line.startsWith('CommandScheduler loop overrun')) {
		return 'warning';
	}
	return 'info';
}

/**
 * Merge the samples of string entries into one time-ordered list of messages. Messages at the same time keep the order of `sources`.
 * Samples are split into lines, and indented lines (ex. stack traces) join the source's previous message, even from an earlier sample, since console output is logged in arbitrary chunks.
 */
export function mergeMessages(sources: readonly Samples[]): ConsoleMessages {
	const total = sources.reduce((sum, samples) => sum + samples.length, 0);
	const times: number[] = [];
	const texts: string[] = [];
	const levels: MessageLevel[] = [];
	const next = sources.map(() => 0);
	/** Index of each source's latest message */
	const latest = sources.map(() => -1);

	for (let i = 0; i < total; i++) {
		// Pick the source with the earliest next message, there are usually only 1 or 2 sources
		let best = -1;
		let time = 0;
		for (const [source, samples] of sources.entries()) {
			if (next[source]! < samples.length && (best === -1 || samples.timestamps[next[source]!]! < time)) {
				best = source;
				time = samples.timestamps[next[source]!]!;
			}
		}

		for (const line of formatValue(sources[best]!.values[next[best]!]).split('\n')) {
			if (line.trim() === '') {
				continue;
			}
			if (/^\s/u.test(line) && latest[best] !== -1) {
				texts[latest[best]!] += `\n${line}`;
			} else {
				latest[best] = texts.length;
				times.push(time);
				texts.push(line);
				levels.push(messageLevel(line));
			}
		}
		next[best]!++;
	}

	return { ids: Uint32Array.from(texts.keys()), times: Float64Array.from(times), texts, levels };
}

/** How to match a search query */
export type SearchOptions = { readonly caseSensitive: boolean; readonly wholeWord: boolean; readonly regex: boolean };

/** Pattern for finding `query` with `options`, throws a `SyntaxError` for an invalid regular expression */
export function searchPattern(query: string, options: SearchOptions): RegExp {
	let source = options.regex ? query : query.replaceAll(/[\\^$.*+?()[\]{}|/]/gu, '\\$&');
	if (options.wholeWord) {
		source = `\\b(?:${source})\\b`;
	}
	return new RegExp(source, options.caseSensitive ? 'gu' : 'giu');
}

/** Messages matching `pattern` at `minimumLevel` or above, or every message at the level without a pattern */
export function filterMessages(
	messages: ConsoleMessages,
	pattern: RegExp | undefined,
	minimumLevel: MessageLevel,
): ConsoleMessages {
	const minimumRank = messageLevels.indexOf(minimumLevel);
	const ids: number[] = [];
	const times: number[] = [];
	const texts: string[] = [];
	const levels: MessageLevel[] = [];

	for (const [i, text] of messages.texts.entries()) {
		const level = messages.levels[i]!;
		// `search()` ignores `lastIndex`, unlike `test()` with a global pattern
		if (messageLevels.indexOf(level) >= minimumRank && (pattern === undefined || text.search(pattern) !== -1)) {
			ids.push(messages.ids[i]!);
			times.push(messages.times[i]!);
			texts.push(text);
			levels.push(level);
		}
	}

	return { ids: Uint32Array.from(ids), times: Float64Array.from(times), texts, levels };
}

/** Where `pattern` matches `text` as `[start, end, start, end, ...]`, skipping empty matches */
export function matchRanges(text: string, pattern: RegExp): number[] {
	const ranges: number[] = [];
	for (const match of text.matchAll(pattern)) {
		if (match[0] !== '') {
			ranges.push(match.index, match.index + match[0].length);
		}
	}
	return ranges;
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

/**
 * Where to move the cursor to show the next message, or the one before the latest message at or before `time`, or `undefined` when there isn't one.
 * Messages at the same time can only be shown together, so going back skips past all of them.
 */
export function stepTime(messages: ConsoleMessages, time: number, direction: 1 | -1): number | undefined {
	const count = countAtOrBefore(messages, time);
	if (direction === 1) {
		return messages.times[count];
	}
	let index = count - 1;
	while (index > 0 && messages.times[index - 1] === messages.times[count - 1]) {
		index--;
	}
	return index > 0 ? messages.times[index - 1] : undefined;
}
