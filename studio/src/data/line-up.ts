// Lines up sources so the same moments of different matches, and logs of the same run on different clocks, line up
import type { DataSet } from '@/data/data-set';
import { findEntry } from '@/data/samples';
import { getModePeriods, type ModePeriod, type RobotMode } from '@/timeline/events';

// Times are in µs

type Transition = { time: number; from: RobotMode; to: RobotMode };

/** Reward per µs both sources are enabled in the same mode, or enabled in different modes */
const sameModeWeight = 1;
const otherModeWeight = 0.25;
/** Penalty per µs one source is enabled and the other isn't while both have data */
const mismatchWeight = 0.25;
/** Penalty per µs a source is enabled outside the other's data */
const outsideWeight = 0.1;
/** Offsets that score within this of each other are tied */
const tieTolerance = 1000;

function periodsOf(data: DataSet): readonly ModePeriod[] {
	const range = data.timeRange ?? (data.start === undefined ? undefined : { start: data.start, end: data.end! });
	return range === undefined ? [] : getModePeriods(range, (name) => findEntry(data.entries, name));
}

const isEnabled = (mode: RobotMode) => mode !== 'disabled' && mode !== 'estop';

function transitions(periods: readonly ModePeriod[]): Transition[] {
	return periods.slice(1).map((period, index) => ({ time: period.start, from: periods[index]!.mode, to: period.mode }));
}

/** Whether two transitions can be the same moment: both enables, both disables, or the same change of mode */
function compatible(a: Transition, b: Transition): boolean {
	const rising = (transition: Transition) => !isEnabled(transition.from) && isEnabled(transition.to);
	const falling = (transition: Transition) => isEnabled(transition.from) && !isEnabled(transition.to);
	if (rising(a) || rising(b)) {
		return rising(a) && rising(b);
	}
	if (falling(a) || falling(b)) {
		return falling(a) && falling(b);
	}
	return isEnabled(a.from) && a.from === b.from && a.to === b.to;
}

function overlap(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
	return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

/** How long the robot was enabled in `periods`, moved `shift` later, between `start` and `end` */
function enabledIn(periods: readonly ModePeriod[], shift: number, start: number, end: number): number {
	return periods
		.filter((period) => isEnabled(period.mode))
		.reduce((sum, period) => sum + overlap(period.start + shift, period.end + shift, start, end), 0);
}

/** How long the robot was enabled in `periods` */
function enabledTotal(periods: readonly ModePeriod[]): number {
	return periods.filter((period) => isEnabled(period.mode)).reduce((sum, period) => sum + period.end - period.start, 0);
}

/** How well `log`'s robot modes, moved `offset` later, match `base`'s */
function score(
	base: readonly ModePeriod[],
	baseRange: { start: number; end: number },
	log: readonly ModePeriod[],
	logRange: { start: number; end: number },
	offset: number,
): number {
	const windowStart = Math.max(baseRange.start, logRange.start + offset);
	const windowEnd = Math.min(baseRange.end, logRange.end + offset);
	if (windowEnd <= windowStart) {
		return -Infinity;
	}
	let total = 0;
	let enabledOverlap = 0;
	for (const a of base) {
		if (!isEnabled(a.mode)) {
			continue;
		}
		for (const b of log) {
			if (!isEnabled(b.mode)) {
				continue;
			}
			const time = overlap(a.start, a.end, b.start + offset, b.end + offset);
			enabledOverlap += time;
			total += time * (a.mode === b.mode ? sameModeWeight : otherModeWeight);
		}
	}
	const baseInWindow = enabledIn(base, 0, windowStart, windowEnd);
	const logInWindow = enabledIn(log, offset, windowStart, windowEnd);
	const mismatch = baseInWindow + logInWindow - 2 * enabledOverlap;
	const outside = enabledTotal(base) - baseInWindow + enabledTotal(log) - logInWindow;
	return total - mismatch * mismatchWeight - outside * outsideWeight;
}

/**
 * How far to move `log` so it lines up with `base`: by when the robot was enabled, disabled, and in auto or teleop when
 * both have Driver Station data that matches, otherwise by their starts. `latestEnable` lines it up with only the
 * latest time `base` was enabled, ex. a live session's latest run, or with `base`'s start if it was never enabled.
 */
export function lineUpOffset(base: DataSet, log: DataSet, latestEnable = false): number {
	const baseRange = base.timeRange ?? { start: base.start ?? 0, end: base.end ?? base.start ?? 0 };
	const logRange = log.timeRange ?? { start: log.start ?? 0, end: log.end ?? log.start ?? 0 };
	const startOffset = baseRange.start - logRange.start;
	let basePeriods = periodsOf(base);
	if (latestEnable) {
		const latest = basePeriods.findLastIndex(
			(period, index) => isEnabled(period.mode) && (index === 0 || !isEnabled(basePeriods[index - 1]!.mode)),
		);
		basePeriods = latest === -1 ? [] : basePeriods.slice(Math.max(0, latest - 1));
	}
	const logPeriods = periodsOf(log);
	if (!basePeriods.some((period) => isEnabled(period.mode)) || !logPeriods.some((period) => isEnabled(period.mode))) {
		return startOffset;
	}

	const candidates: { offset: number; rising: boolean }[] = [];
	for (const a of transitions(basePeriods)) {
		for (const b of transitions(logPeriods)) {
			if (compatible(a, b)) {
				candidates.push({ offset: a.time - b.time, rising: !isEnabled(a.from) });
			}
		}
	}
	let best: { offset: number; rising: boolean; score: number } | undefined;
	for (const candidate of candidates) {
		const value = score(basePeriods, baseRange, logPeriods, logRange, candidate.offset);
		const better =
			best === undefined ||
			value > best.score + tieTolerance ||
			(Math.abs(value - best.score) <= tieTolerance &&
				(candidate.rising === best.rising
					? Math.abs(candidate.offset - startOffset) < Math.abs(best.offset - startOffset)
					: candidate.rising));
		if (better) {
			best = { ...candidate, score: value };
		}
	}
	return best === undefined || best.score <= 0 ? startOffset : best.offset;
}
