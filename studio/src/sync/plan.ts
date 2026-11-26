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
}

export interface SyncFilter {
	/** Only sync logs from this many days before now */
	days: number;
	/** Only sync logs from matches run by the field */
	officialOnly: boolean;
	/** Most bytes of logs to keep in the sync folder, `undefined` for no limit */
	capBytes: number | undefined;
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
	/** Logs to copy from the robot, newest first. `offset` bytes are already saved, the rest is appended. */
	downloads: { log: RemoteLog; offset: number }[];
	/** Names of logs in the sync folder to delete to stay under the storage limit */
	deletions: string[];
	/** Every log that's kept or wanted, newest first */
	logs: PlannedLog[];
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
 * or deleted from the sync folder. Otherwise nothing is deleted, even logs that no longer pass the filter.
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
	const plan: SyncPlan = { downloads: [], deletions: [], logs: [] };
	let used = 0;
	let full = false;
	for (const entry of newestFirst) {
		const size = Math.max(entry.remote?.size ?? 0, entry.local?.size ?? 0);
		full ||= filter.capBytes !== undefined && used + size > filter.capBytes;
		if (full) {
			if (entry.local) {
				plan.deletions.push(entry.name);
			} else if (entry.wanted) {
				plan.logs.push({ name: entry.name, date: entry.date, size, state: 'over-limit' });
			}
			continue;
		}

		used += size;
		const offset = entry.local?.size ?? 0;
		if (entry.wanted && entry.remote && entry.remote.size > offset) {
			plan.downloads.push({ log: entry.remote, offset });
			plan.logs.push({ name: entry.name, date: entry.date, size, state: 'queued' });
		} else if (entry.local) {
			plan.logs.push({ name: entry.name, date: entry.date, size, state: 'synced' });
		}
	}
	return plan;
}
