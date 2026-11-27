import { compareLogNames, parseLogName } from '@/sync/log-names';

/** A log file on the robot */
export interface RemoteLog {
	path: string;
	name: string;
	size: number;
}

/** A log file in the sync folder */
export interface LocalLog {
	name: string;
	size: number;
	/** The folder it's in, relative to the sync folder, `''` for the sync folder itself */
	dir: string;
}

export interface SyncFilter {
	/** Only sync logs from this many days before now */
	days: number;
	/** Only sync logs from matches run by the field */
	officialOnly: boolean;
	/** Most bytes of logs to keep in the sync folder, `undefined` for no limit */
	capBytes: number | undefined;
	/** Whether a log in the sync folder may be deleted to stay under the limit, ex. only once it's uploaded */
	canDelete?: (log: LocalLog) => boolean;
}

/** A log that's synced or will be, or that would be if it fit under the storage limit */
export interface PlannedLog {
	name: string;
	/** When the log started, in milliseconds since the Unix epoch */
	date: number;
	/** Size of the whole log in bytes */
	size: number;
	state: 'synced' | 'queued' | 'over-limit';
}

export interface SyncPlan {
	/**
	 * Logs to copy from the robot, newest first. `offset` bytes are already saved in `local`, and the rest is appended.
	 */
	downloads: { log: RemoteLog; offset: number; local: LocalLog | undefined }[];
	/** Logs in the sync folder to delete to stay under the storage limit */
	deletions: LocalLog[];
	/** Every log that's kept or wanted, newest first */
	logs: PlannedLog[];
	/** Whether a log doesn't fit only because of logs that can't be deleted yet, see `SyncFilter.canDelete` */
	waitingToDelete: boolean;
}

const dayMs = 24 * 60 * 60 * 1000;

interface Candidate {
	name: string;
	date: number;
	remote: RemoteLog | undefined;
	local: LocalLog | undefined;
	wanted: boolean;
}

/**
 * Decide which logs to copy from the robot and which to delete from the sync folder.
 * Only logs with recognized names (see `parseLogName()`) are synced or deleted.
 *
 * With a storage limit, the newest logs are kept until the next one wouldn't fit, and every older log is left on the robot
 * or deleted from the sync folder. Logs that can't be deleted are kept first, and the rest fill the space that's left.
 * Without a limit nothing is deleted, even logs that no longer pass the filter.
 */
export function planSync(remoteLogs: RemoteLog[], localLogs: LocalLog[], filter: SyncFilter, now: number): SyncPlan {
	const candidates = new Map<string, Candidate>();
	const candidate = (name: string): Candidate | undefined => {
		const existing = candidates.get(name);
		if (existing) {
			return existing;
		}
		const parsed = parseLogName(name);
		if (!parsed) {
			return undefined;
		}
		const created: Candidate = {
			name,
			date: parsed.date.getTime(),
			remote: undefined,
			local: undefined,
			wanted: false,
		};
		candidates.set(name, created);
		return created;
	};

	const since = now - filter.days * dayMs;
	for (const log of remoteLogs) {
		const parsed = parseLogName(log.name);
		if (!parsed || parsed.date.getTime() < since || (filter.officialOnly && parsed.match === undefined)) {
			continue;
		}
		const entry = candidate(log.name)!;
		// The same name in two log folders, keep the bigger copy
		if (!entry.remote || log.size > entry.remote.size) {
			entry.remote = log;
		}
		entry.wanted = true;
	}
	for (const log of localLogs) {
		const entry = candidate(log.name);
		if (entry) {
			entry.local = log;
		}
	}

	const newestFirst = [...candidates.values()].toSorted((a, b) => b.date - a.date || compareLogNames(b.name, a.name));
	const plan: SyncPlan = { downloads: [], deletions: [], logs: [], waitingToDelete: false };
	const sizeOf = (entry: Candidate) => Math.max(entry.remote?.size ?? 0, entry.local?.size ?? 0);
	const kept = (entry: Candidate) =>
		filter.capBytes !== undefined && entry.local !== undefined && filter.canDelete?.(entry.local) === false;
	const keptBytes = newestFirst.reduce((sum, entry) => (kept(entry) ? sum + sizeOf(entry) : sum), 0);
	let used = keptBytes;
	let full = false;
	for (const entry of newestFirst) {
		const size = sizeOf(entry);
		if (!kept(entry)) {
			const fits = filter.capBytes === undefined || used + size <= filter.capBytes;
			if (!full && !fits && entry.wanted && used - keptBytes + size <= filter.capBytes!) {
				plan.waitingToDelete = true;
			}
			full ||= !fits;
		}
		if (full && !kept(entry)) {
			if (entry.local) {
				plan.deletions.push(entry.local);
			} else if (entry.wanted) {
				plan.logs.push({ name: entry.name, date: entry.date, size, state: 'over-limit' });
			}
			continue;
		}

		if (!kept(entry)) {
			used += size;
		}
		const offset = entry.local?.size ?? 0;
		if (entry.wanted && entry.remote && entry.remote.size > offset) {
			plan.downloads.push({ log: entry.remote, offset, local: entry.local });
			plan.logs.push({ name: entry.name, date: entry.date, size, state: 'queued' });
		} else if (entry.local) {
			plan.logs.push({ name: entry.name, date: entry.date, size, state: 'synced' });
		}
	}
	return plan;
}
