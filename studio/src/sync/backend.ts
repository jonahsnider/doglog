import { Channel, invoke } from '@tauri-apps/api/core';
import { join } from '@tauri-apps/api/path';
import { mkdir, readDir, remove, stat } from '@tauri-apps/plugin-fs';
import type { LocalLog, RemoteLog } from '@/sync/plan';

/** How long the robot must stay disabled before sync resumes, so the short pause between auto and teleop doesn't start it */
const resumeDelay = 10_000;

export interface RobotEnabledWatcher {
	/** How many milliseconds until sync can run, 0 if it can run now */
	pausedFor: () => number;
	stop: () => void;
}

/** Where sync copies logs from and to */
export interface SyncBackend {
	/** List the logs on the robot, throws if the robot can't be reached */
	listRobotLogs: (host: string) => Promise<RemoteLog[]>;
	/** List the logs in the sync folder, which is empty before the first sync */
	listSavedLogs: (folder: string) => Promise<LocalLog[]>;
	createFolder: (folder: string) => Promise<void>;
	deleteLog: (folder: string, name: string) => Promise<void>;
	/**
	 * Copy the rest of `log` after the `offset` bytes already in the sync folder.
	 * Returns the bytes copied, which is less than the rest of the log if it was cancelled.
	 */
	download: (
		host: string,
		log: RemoteLog,
		folder: string,
		offset: number,
		onProgress: (copied: number) => void,
	) => Promise<number>;
	cancelDownload: () => void;
	disconnect: () => Promise<void>;
	/** Follow whether the robot is enabled, `onChange` is called whenever `pausedFor()` may have changed */
	watchRobotEnabled: (host: string, onChange: () => void) => Promise<RobotEnabledWatcher>;
}

/** Track when the robot was enabled and disabled, to tell how long sync has to wait */
export function trackEnabled(onChange: () => void): {
	set: (enabled: boolean) => void;
	pausedFor: () => number;
} {
	let enabled = false;
	let disabledAt = Number.NEGATIVE_INFINITY;
	return {
		set: (value) => {
			if (value === enabled) {
				return;
			}
			enabled = value;
			if (!value) {
				disabledAt = Date.now();
			}
			onChange();
		},
		pausedFor: () => (enabled ? Number.POSITIVE_INFINITY : Math.max(0, disabledAt + resumeDelay - Date.now())),
	};
}

/** A roboRIO, over SFTP in the desktop app */
export const robotBackend: SyncBackend = {
	listRobotLogs: (host) => invoke<RemoteLog[]>('list_robot_logs', { host }),
	listSavedLogs: async (folder) => {
		let entries;
		try {
			entries = await readDir(folder);
		} catch {
			// Not created until the first sync
			return [];
		}

		const logs = entries.filter((entry) => entry.isFile && entry.name.endsWith('.wpilog'));
		return Promise.all(logs.map(async ({ name }) => ({ name, size: (await stat(await join(folder, name))).size })));
	},
	createFolder: (folder) => mkdir(folder, { recursive: true }),
	deleteLog: async (folder, name) => remove(await join(folder, name)),
	download: async (host, log, folder, offset, onProgress) =>
		invoke<number>('download_robot_log', {
			host,
			remotePath: log.path,
			localPath: await join(folder, log.name),
			offset,
			onProgress: new Channel<number>(onProgress),
		}),
	cancelDownload: () => void invoke('cancel_robot_download'),
	disconnect: () => invoke('disconnect_robot'),
	watchRobotEnabled: async (host, onChange) => {
		// The NT4 client is large, only load it when it's needed
		const { watchRobotEnabled } = await import('@/sync/robot-enabled');
		return watchRobotEnabled(host, onChange);
	},
};
