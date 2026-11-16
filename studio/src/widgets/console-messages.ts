import { formatValue } from '@/data/format-value';
import type { Samples } from '@/data/samples';

export const messageLevels = ['info', 'warning', 'error'] as const;
export type MessageLevel = (typeof messageLevels)[number];

/** Console messages in time order, `times[i]` (µs) is the time of `texts[i]` and `levels[i]` is its level */
export type ConsoleMessages = {
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

	return { times: Float64Array.from(times), texts, levels };
}

/** Messages containing `query`, ignoring case, at `minimumLevel` or above */
export function filterMessages(messages: ConsoleMessages, query: string, minimumLevel: MessageLevel): ConsoleMessages {
	const needle = query.toLowerCase();
	const minimumRank = messageLevels.indexOf(minimumLevel);
	const times: number[] = [];
	const texts: string[] = [];
	const levels: MessageLevel[] = [];

	for (const [i, text] of messages.texts.entries()) {
		const level = messages.levels[i]!;
		if (messageLevels.indexOf(level) >= minimumRank && text.toLowerCase().includes(needle)) {
			times.push(messages.times[i]!);
			texts.push(text);
			levels.push(level);
		}
	}

	return { times: Float64Array.from(times), texts, levels };
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
