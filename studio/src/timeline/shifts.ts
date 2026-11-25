import { getEntry } from '@/data/data-store';
import type { Source } from '@/data/source';
import { parseLogName } from '@/sync/log-names';
import type { ModePeriod } from '@/timeline/events';

/** A timeframe of a 2026 match's teleop when the robot's alliance hub was active. Times in µs. */
export type MatchShift = { readonly name: string; readonly start: number; readonly end: number };

// 2026 match timing (REBUILT game manual section 6.4), in µs. Both hubs are active in the transition shift and end
// game, the alliance shifts alternate starting with the alliance whose hub is active first.
const autoDuration = 20_000_000;
const teleopShifts = [
	{ name: 'Transition shift', duration: 10_000_000, active: 'both' },
	{ name: 'Shift 1', duration: 25_000_000, active: 'first' },
	{ name: 'Shift 2', duration: 25_000_000, active: 'second' },
	{ name: 'Shift 3', duration: 25_000_000, active: 'first' },
	{ name: 'Shift 4', duration: 25_000_000, active: 'second' },
	{ name: 'End game', duration: 30_000_000, active: 'both' },
] as const;
const teleopDuration = teleopShifts.reduce((total, shift) => total + shift.duration, 0);
/** Slack (µs) for the Driver Station's timing when comparing auto and teleop to a match's */
const matchTolerance = 500_000;
/** Longest wait (µs) between auto and teleop in a match, the field waits about 3 s to count auto scoring */
const maxTeleopDelay = 5_000_000;

/**
 * Whether the robot's alliance hub is active in shift 1 of the match at `time`, from NetworkTables' FMSInfo in logs and
 * live sessions. `undefined` unless the field's game data is exactly the alliance whose hub is inactive first (`R` or
 * `B`), which it sends about 3 s into teleop.
 */
function getActiveFirst(time: number): boolean | undefined {
	const inactiveFirst = getEntry('/FMSInfo/GameSpecificMessage')?.samples.valueAt(time);
	const red = getEntry('/FMSInfo/IsRedAlliance')?.samples.valueAt(time);
	return (inactiveFirst === 'R' || inactiveFirst === 'B') && typeof red === 'boolean'
		? (inactiveFirst === 'R') !== red
		: undefined;
}

/**
 * The teleop shifts when the robot's alliance hub was active in each 2026 match of a source. Matches are recognized by
 * the field's timing: 20 s of auto, then up to 2:20 of teleop starting within 5 s, which the Driver Station's practice
 * mode also follows. `activeFirstAt` says whose hub is active first, see `getActiveFirst()`, which it defaults to; matches without it have no
 * shifts. Shifts end where teleop does, ex. when the robot is e-stopped.
 */
export function getActiveShifts(
	periods: readonly ModePeriod[],
	year: number | undefined,
	activeFirstAt: (time: number) => boolean | undefined = getActiveFirst,
): readonly MatchShift[] {
	if (year !== 2026) {
		return [];
	}
	const shifts: MatchShift[] = [];
	for (const [index, auto] of periods.entries()) {
		if (auto.mode !== 'auto' || Math.abs(auto.end - auto.start - autoDuration) > matchTolerance) {
			continue;
		}
		// Teleop starts right after auto, or after the robot is disabled for a moment
		const teleop = periods.slice(index + 1, index + 3).find((period) => period.mode !== 'disabled');
		if (
			teleop?.mode !== 'teleop' ||
			teleop.start - auto.end > maxTeleopDelay ||
			teleop.end - teleop.start > teleopDuration + matchTolerance
		) {
			continue;
		}
		// The game data arrives during teleop and stays until the next match
		const activeFirst = activeFirstAt(teleop.end);
		if (activeFirst === undefined) {
			continue;
		}
		let start = teleop.start;
		for (const { name, duration, active } of teleopShifts) {
			if (start >= teleop.end) {
				break;
			}
			if (active === 'both' || (active === 'first') === activeFirst) {
				shifts.push({ name, start, end: Math.min(start + duration, teleop.end) });
			}
			start += duration;
		}
	}
	return shifts;
}

/**
 * The year a source is from, so game-specific timing only applies to its season. Logs use the wall clock WPILib's
 * `DataLogManager` records, or the date in their file name, and are `undefined` without either. Live sessions are from now.
 */
export function getSourceYear(source: Source): number | undefined {
	if (source.type === 'live') {
		return new Date().getFullYear();
	}
	// µs since 1970, logged once the Driver Station sets the robot's clock
	const systemTime = getEntry('/systemTime')?.samples.valueAt(Infinity);
	if (typeof systemTime === 'number') {
		return new Date(systemTime / 1000).getUTCFullYear();
	}
	return parseLogName(source.fileName)?.date.getUTCFullYear();
}
