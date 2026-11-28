import { type Entry, getEntry, getGaps, type TimeRange } from '@/data/data-store';
import { type ModePeriod, readModePeriods } from '@/data/robot-modes';
import { settingsStore } from '@/settings';

export type { ModePeriod, RobotMode } from '@/data/robot-modes';

export type AlertLevel = 'error' | 'warning';

/** A span of time an alert was active. Times in µs, alerts still active at the end of the source end there. */
export type AlertSpan = {
	readonly start: number;
	readonly end: number;
	readonly level: AlertLevel;
	readonly text: string;
};

/**
 * The robot's mode over time, from the Driver Station data in a log or NetworkTables. Empty without that data.
 * Reads the time base's entries unless `find` reads another source's.
 */
export function getModePeriods(
	range: TimeRange,
	find: (name: string) => Entry | undefined = getEntry,
): readonly ModePeriod[] {
	return readModePeriods(range, find);
}

const alertLevels: readonly { level: AlertLevel; suffix: string }[] = [
	{ level: 'error', suffix: '/errors' },
	{ level: 'warning', suffix: '/warnings' },
];

/** Alerts cleared for less than this long (µs) are treated as staying active, so flapping alerts show as one span */
const alertDebounce = 5_000_000;

/** Add a span for each time an alert is in a list of active alerts (`string[]` entry). Spans still active end at `end`. */
function addAlertSpans(entry: Entry, level: AlertLevel, end: number, spans: AlertSpan[]): void {
	const { samples } = entry;
	const { timestamps, length } = samples;
	let active = new Set<string>();
	// Spans end at `Infinity` while the alert is active
	const entrySpans: { start: number; end: number; level: AlertLevel; text: string }[] = [];
	const latest = new Map<string, (typeof entrySpans)[number]>();
	for (let index = 0; index < length; index++) {
		const time = timestamps[index]!;
		const value = samples.value(index);
		const texts = new Set(Array.isArray(value) ? value.map(String) : []);
		for (const text of texts) {
			if (active.has(text)) {
				continue;
			}
			const span = latest.get(text);
			if (span && time - span.end < alertDebounce) {
				span.end = Infinity;
			} else {
				const added = { start: time, end: Infinity, level, text };
				entrySpans.push(added);
				latest.set(text, added);
			}
		}
		for (const text of active) {
			const span = latest.get(text);
			if (span && !texts.has(text)) {
				span.end = time;
			}
		}
		active = texts;
	}
	for (const span of entrySpans) {
		spans.push({ ...span, end: Math.min(span.end, end) });
	}
}

/**
 * When errors and warnings from WPILib alert groups (entries with a `.type` of `Alerts`) were active, sorted by start.
 * Info alerts are left out so the timeline isn't cluttered.
 */
export function getAlertSpans(entries: readonly Entry[], range: TimeRange): readonly AlertSpan[] {
	const spans: AlertSpan[] = [];

	for (const typeEntry of entries) {
		if (!typeEntry.name.endsWith('/.type') || typeEntry.samples.value(typeEntry.samples.length - 1) !== 'Alerts') {
			continue;
		}
		const group = typeEntry.name.slice(0, -'/.type'.length);

		for (const { level, suffix } of alertLevels) {
			const entry = getEntry(group + suffix);
			if (entry?.kind === 'string[]') {
				addAlertSpans(entry, level, range.end, spans);
			}
		}
	}

	return spans.toSorted((a, b) => a.start - b.start);
}

/** Idle periods longer than this (µs) are compressed on the timeline and fast-forwarded through during playback */
const minCompressedDuration = 15_000_000;
/** Time (µs) kept at normal scale at each end of an idle period, where things like brownouts and startup happen */
const compressionMargin = 2_000_000;

/** A span of time (µs) shown compressed on the timeline */
export type CompressedSpan = { readonly start: number; readonly end: number };

/** Long idle spans of the active source that are compressed on the timeline, empty when compression is turned off */
export function getActiveCompressedSpans(range: TimeRange): CompressedSpan[] {
	return settingsStore.get().timelineCompress ? getCompressedSpans(getModePeriods(range), getGaps()) : [];
}

/** Playback fast-forwards through a compressed span in about 1.5 seconds. */
export function rateInSpan(speed: number, span: CompressedSpan | undefined): number {
	return span ? Math.max(speed, (span.end - span.start) / 1_500_000) : speed;
}

/**
 * The long stretches of a source where the robot was disabled or the live session was disconnected (`gaps`), minus a
 * margin at each end, sorted and merged where they overlap. Disabled periods aren't compressed if the robot was never
 * enabled, since there's nothing to make room for. A live source's ongoing disabled period is compressed too, with its
 * newest seconds kept at normal scale like any other margin.
 */
export function getCompressedSpans(periods: readonly ModePeriod[], gaps: readonly TimeRange[]): CompressedSpan[] {
	const disabled = periods.some((period) => period.mode !== 'disabled')
		? periods.filter((period) => period.mode === 'disabled')
		: [];
	const idle = [...disabled, ...gaps]
		.filter((span) => span.end - span.start > minCompressedDuration)
		.map((span) => ({ start: span.start + compressionMargin, end: span.end - compressionMargin }))
		.toSorted((a, b) => a.start - b.start);

	const merged: { start: number; end: number }[] = [];
	for (const span of idle) {
		const last = merged.at(-1);
		if (last && span.start <= last.end) {
			last.end = Math.max(last.end, span.end);
		} else {
			merged.push(span);
		}
	}
	return merged;
}
