import { type Entry, getEntry, type TimeRange } from '@/data/data-store';

export type RobotMode = 'disabled' | 'auto' | 'teleop' | 'test' | 'estop';

/** A span of time the robot stayed in one mode. Times in µs. */
export type ModePeriod = { readonly mode: RobotMode; readonly start: number; readonly end: number };

export type AlertLevel = 'error' | 'warning';

/** A span of time an alert was active. Times in µs, alerts still active at the end of the source end there. */
export type AlertSpan = {
	readonly start: number;
	readonly end: number;
	readonly level: AlertLevel;
	readonly text: string;
};

// Logs have one boolean entry per mode flag, written by `DriverStation.startDataLog()`
const dsEntryNames = ['/DS:enabled', '/DS:autonomous', '/DS:test', '/DS:estop'] as const;
// Live sources have the same flags as a bitfield in NetworkTables
const controlDataName = '/FMSInfo/FMSControlData';
const controlBits = { enabled: 0x01, autonomous: 0x02, test: 0x04, estop: 0x08 };

function modeOf(enabled: unknown, autonomous: unknown, test: unknown, estop: unknown): RobotMode {
	if (estop === true) {
		return 'estop';
	}
	if (enabled !== true) {
		return 'disabled';
	}
	if (test === true) {
		return 'test';
	}
	return autonomous === true ? 'auto' : 'teleop';
}

/** Combine the times every source entry changed into one list of periods, merging neighbors with the same mode */
function toPeriods(
	sources: readonly Entry[],
	modeAt: (time: number) => RobotMode,
	range: TimeRange,
): readonly ModePeriod[] {
	const times = [
		...new Set(sources.flatMap((entry) => [...entry.samples.timestamps.subarray(0, entry.samples.length)])),
	];
	times.sort((a, b) => a - b);

	const periods: { mode: RobotMode; start: number; end: number }[] = [];
	for (const time of times) {
		const mode = modeAt(time);
		const last = periods.at(-1);
		if (last?.mode === mode) {
			continue;
		}
		if (last) {
			last.end = time;
		}
		periods.push({ mode, start: time, end: range.end });
	}
	return periods;
}

/** The robot's mode over time, from the Driver Station data in a log or NetworkTables. Empty without that data. */
export function getModePeriods(range: TimeRange): readonly ModePeriod[] {
	const [enabled, autonomous, test, estop] = dsEntryNames.map((name) => getEntry(name));
	const dsEntries = [enabled, autonomous, test, estop].filter((entry): entry is Entry => entry?.kind === 'boolean');
	if (dsEntries.length > 0) {
		return toPeriods(
			dsEntries,
			(time) =>
				modeOf(
					enabled?.samples.valueAt(time),
					autonomous?.samples.valueAt(time),
					test?.samples.valueAt(time),
					estop?.samples.valueAt(time),
				),
			range,
		);
	}

	const controlData = getEntry(controlDataName);
	if (controlData?.kind === 'number') {
		return toPeriods(
			[controlData],
			(time) => {
				const bits = Number(controlData.samples.valueAt(time));
				return modeOf(
					(bits & controlBits.enabled) !== 0,
					(bits & controlBits.autonomous) !== 0,
					(bits & controlBits.test) !== 0,
					(bits & controlBits.estop) !== 0,
				);
			},
			range,
		);
	}

	return [];
}

const alertLevels: readonly { level: AlertLevel; suffix: string }[] = [
	{ level: 'error', suffix: '/errors' },
	{ level: 'warning', suffix: '/warnings' },
];

/** Alerts cleared for less than this long (µs) are treated as staying active, so flapping alerts show as one span */
const alertDebounce = 5_000_000;

/** Add a span for each time an alert is in a list of active alerts (`string[]` entry). Spans still active end at `end`. */
function addAlertSpans(entry: Entry, level: AlertLevel, end: number, spans: AlertSpan[]): void {
	const { timestamps, values, length } = entry.samples;
	let active = new Set<string>();
	// Spans end at `Infinity` while the alert is active
	const entrySpans: { start: number; end: number; level: AlertLevel; text: string }[] = [];
	const latest = new Map<string, (typeof entrySpans)[number]>();
	for (let index = 0; index < length; index++) {
		const time = timestamps[index]!;
		const value = values[index];
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
		if (!typeEntry.name.endsWith('/.type') || typeEntry.samples.values.at(-1) !== 'Alerts') {
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
