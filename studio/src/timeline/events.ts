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

const driverStationEntries = [
	['/DS:enabled', '/DS:autonomous', '/DS:test', '/DS:estop'],
	...['/DriverStation/', '/AdvantageKit/DriverStation/', '/NT:/AdvantageKit/DriverStation/'].map(
		(prefix) =>
			[
				`${prefix}Enabled`,
				`${prefix}Autonomous`,
				`${prefix}Test`,
				`${prefix}EmergencyStop`,
				`${prefix}RobotMode`,
			] as const,
	),
] as const;
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
	for (const [enabledName, autoName, testName, estopName, modeName] of driverStationEntries) {
		const [enabled, autonomous, test, estop] = [enabledName, autoName, testName, estopName].map((name) => {
			const entry = getEntry(name);
			return entry?.kind === 'boolean' && entry.samples.length > 0 ? entry : undefined;
		});
		const flags = [enabled, autonomous, test, estop].filter((entry) => entry !== undefined);
		if (flags.length === 0) {
			continue;
		}
		const mode = modeName === undefined ? undefined : getEntry(modeName);
		const robotMode = mode?.kind === 'string' ? mode : undefined;
		return toPeriods(
			robotMode ? [...flags, robotMode] : flags,
			(time) => {
				// The 2027 Driver Station logs a mode name instead of separate auto and test flags.
				const selected = robotMode?.samples.valueAt(time);
				return modeOf(
					enabled?.samples.valueAt(time),
					selected === undefined ? autonomous?.samples.valueAt(time) : selected === 'AUTONOMOUS',
					selected === undefined ? test?.samples.valueAt(time) : selected === 'UTILITY',
					estop?.samples.valueAt(time),
				);
			},
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

/** Idle periods longer than this (µs) are compressed on the timeline and fast-forwarded through during playback */
const minCompressedDuration = 15_000_000;
/** Time (µs) kept at normal scale at each end of an idle period, where things like brownouts and startup happen */
const compressionMargin = 2_000_000;

/** A span of time (µs) shown compressed on the timeline */
export type CompressedSpan = { readonly start: number; readonly end: number };

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
