import { type LogName, type MatchType, compareLogNames, parseLogName } from '@/sync/log-names';
import type { BoardLog } from '@/sync/sync-board';

/** How far apart a HOOT log and a robot log from outside a match can start and still be from the same run */
const hootWindowMs = 2 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, '0');

/** A run's folder for a log that isn't a HOOT log, ex. `2027/CAPH/Q12` or `2027/2027-03-13/14-02-04` */
function ownFolder({ date, match }: LogName): string {
	// Folders use the computer's time zone, so an evening practice is on the day it happened
	const season = date.getFullYear();
	const day = `${season}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
	if (match) {
		const parts = match.label.split(' ');
		const matchId = parts.pop()!;
		// The field doesn't always send an event name, ex. practice fields
		return parts.length > 0 ? `${season}/${parts.join(' ')}/${matchId}` : `${season}/${day}/${matchId}`;
	}
	return `${season}/${day}/${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

/**
 * The folder of the run each log belongs to, relative to the sync folder or the storage's root folder, by log name.
 * Logs from a match are grouped by the match, a WPILib log split into several files stays together, and a HOOT log
 * from outside a match joins the robot log that started closest to it, within a couple of minutes.
 * Names that aren't logs are left out.
 */
export function runFolders(names: Iterable<string>): Map<string, string> {
	const folders = new Map<string, string>();
	const hoots: [string, LogName][] = [];
	const robotLogs: LogName[] = [];
	for (const name of names) {
		const parsed = parseLogName(name);
		if (!parsed) {
			continue;
		}
		if (parsed.canBus && !parsed.match) {
			hoots.push([name, parsed]);
		} else {
			folders.set(name, ownFolder(parsed));
			if (!parsed.canBus && !parsed.match) {
				robotLogs.push(parsed);
			}
		}
	}

	for (const [name, hoot] of hoots) {
		let closest: LogName | undefined;
		for (const log of robotLogs) {
			const distance = Math.abs(log.date.getTime() - hoot.date.getTime());
			if (distance <= hootWindowMs && (!closest || distance < Math.abs(closest.date.getTime() - hoot.date.getTime()))) {
				closest = log;
			}
		}
		folders.set(name, ownFolder(closest ?? hoot));
	}
	return folders;
}

/** A log file in a run */
export interface RunLog {
	name: string;
	size: number;
	/** Absolute path in the sync folder, when it's on this computer */
	path?: string;
	/** Path in the team's storage, when it's uploaded */
	stored?: string;
}

/** A video of a run in the team's storage, see the log-storage spec's video files */
export interface RunVideo {
	/** Ex. Stands */
	angle: string;
	/** Seconds, a moment in the video is the moment in the run's log plus the offset */
	offset: number;
	/** Path of the video file in storage, `undefined` for a YouTube video */
	file?: string;
	youtube?: string;
	/** Path of a frame from the video in storage */
	poster?: string;
	/** Path of the video's `doglog.json` file in storage, `undefined` when it has none yet */
	sidecar?: string;
}

/** Logs from one run of robot code and its videos, with what Studio can tell about it without reading them */
export interface Run {
	/**
	 * The run's folder, relative to the sync folder or the storage's root folder, which identifies it. A video that isn't
	 * linked to a log is a run of its own, identified by the video's path.
	 */
	folder: string;
	/** When the earliest log started, in milliseconds since the Unix epoch, `0` when nothing says */
	start: number;
	/** Ex. `CAPH Q12`, `undefined` for runs outside a match */
	match: string | undefined;
	kind: MatchType | 'other';
	/** The event, from the match or a log from the field outside a match */
	event: string | undefined;
	/** Robot logs first, then HOOT logs, each in name order */
	logs: RunLog[];
	videos: RunVideo[];
	/** Seconds, when the run's `doglog.json` file says */
	duration?: number;
}

const isHoot = (name: string) => name.endsWith('.hoot');

/** Order a run's logs, robot logs first, then HOOT logs, each in name order */
export const compareRunLogs = (a: { name: string }, b: { name: string }) =>
	Number(isHoot(a.name)) - Number(isHoot(b.name)) || compareLogNames(a.name, b.name);

const sortKey = (run: Run) => (run.start === 0 ? Number.POSITIVE_INFINITY : run.start);

/** Order runs newest first, with runs that don't have a date before the rest so they aren't buried */
export const compareRuns = (a: Run, b: Run) => sortKey(b) - sortKey(a) || b.folder.localeCompare(a.folder);

/** Group logs into runs by their run folder, newest first. Logs whose names aren't recognized are left out. */
export function groupRuns(logs: readonly RunLog[]): Run[] {
	const folders = runFolders(logs.map((log) => log.name));
	const runs = new Map<string, Run>();
	for (const log of logs) {
		const folder = folders.get(log.name);
		const parsed = parseLogName(log.name);
		if (folder === undefined || !parsed) {
			continue;
		}
		// A match's label starts with its event, when the field sent one
		const matchEvent = parsed.match?.label.split(' ').slice(0, -1).join(' ');
		const event = matchEvent === undefined || matchEvent === '' ? parsed.event : matchEvent;
		const run = runs.get(folder) ?? {
			folder,
			start: parsed.date.getTime(),
			match: parsed.match?.label,
			kind: parsed.match?.type ?? 'other',
			event,
			logs: [],
			videos: [],
		};
		run.start = Math.min(run.start, parsed.date.getTime());
		run.event ??= event;
		run.logs.push(log);
		runs.set(folder, run);
	}

	for (const run of runs.values()) {
		run.logs.sort(compareRunLogs);
	}
	return [...runs.values()].toSorted(compareRuns);
}

/**
 * One square per run, with the run's logs added up, named after its first robot log.
 * Returns the squares and the names of each square's logs, by the square's name.
 */
export function runSquares(logs: readonly BoardLog[]): { squares: BoardLog[]; members: Map<string, string[]> } {
	const folders = runFolders(logs.map((log) => log.name));
	const byRun = new Map<string, BoardLog[]>();
	for (const log of logs) {
		const folder = folders.get(log.name) ?? log.name;
		byRun.set(folder, [...(byRun.get(folder) ?? []), log]);
	}

	const members = new Map<string, string[]>();
	const squares = [...byRun.values()].map((runLogs): BoardLog => {
		const sorted = runLogs.toSorted(
			(a, b) => Number(a.name.endsWith('.hoot')) - Number(b.name.endsWith('.hoot')) || compareLogNames(a.name, b.name),
		);
		const has = (state: BoardLog['state']) => runLogs.some((log) => log.state === state);
		let state: BoardLog['state'] = 'synced';
		if (has('copying')) {
			state = 'copying';
		} else if (has('queued')) {
			state = 'queued';
		} else if (!has('synced')) {
			state = 'over-limit';
		}
		const { name } = sorted[0]!;
		members.set(
			name,
			sorted.map((log) => log.name),
		);
		return {
			name,
			date: Math.min(...runLogs.map((log) => log.date)),
			size: runLogs.reduce((sum, log) => sum + log.size, 0),
			saved: runLogs.reduce((sum, log) => sum + log.saved, 0),
			state,
		};
	});
	return { squares, members };
}
