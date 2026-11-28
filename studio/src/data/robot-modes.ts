// The robot's mode over time from Driver Station data, apart from `@/timeline/events` so workers can read it too
import type { Entry, TimeRange } from '@/data/data-store';
import {
	controlBits,
	controlDataName,
	controlWordEntries,
	controlWordModes,
	driverStationEntries,
} from '@/data/driver-station';

export type RobotMode = 'disabled' | 'auto' | 'teleop' | 'test' | 'estop';

/** A span of time the robot stayed in one mode. Times in µs. */
export type ModePeriod = { readonly mode: RobotMode; readonly start: number; readonly end: number };

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
	const changeTimes = new Set<number>();
	for (const { samples } of sources) {
		for (let i = 0; i < samples.length; i++) {
			if (i === 0 || samples.value(i) !== samples.value(i - 1)) {
				changeTimes.add(samples.timestamps[i]!);
			}
		}
	}
	const times = [...changeTimes];
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

/**
 * The robot's mode over time, from the Driver Station data in a log or NetworkTables. Empty without that data.
 */
export function readModePeriods(range: TimeRange, find: (name: string) => Entry | undefined): readonly ModePeriod[] {
	for (const [enabledName, autoName, testName, estopName, modeName] of driverStationEntries) {
		const [enabled, autonomous, test, estop] = [enabledName, autoName, testName, estopName].map((name) => {
			const entry = find(name);
			return entry?.kind === 'boolean' && entry.samples.length > 0 ? entry : undefined;
		});
		const flags = [enabled, autonomous, test, estop].filter((entry) => entry !== undefined);
		if (flags.length === 0) {
			continue;
		}
		const mode = modeName === undefined ? undefined : find(modeName);
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

	const controlWord = controlWordEntries
		.map((name) => find(name))
		.find((entry) => entry?.type === 'struct:ControlWord' && entry.samples.length > 0);
	if (controlWord) {
		return toPeriods(
			[controlWord],
			(time) => {
				const value = controlWord.samples.valueAt(time);
				const word = typeof value === 'object' && !Array.isArray(value) ? value : undefined;
				const robotMode = Number(word?.['robotMode']);
				return modeOf(
					word?.['enabled'],
					robotMode === controlWordModes.autonomous,
					robotMode === controlWordModes.utility,
					word?.['eStop'],
				);
			},
			range,
		);
	}

	const controlData = find(controlDataName);
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
