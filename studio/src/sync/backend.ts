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
	/** List the logs in the sync folder and its run folders, which are empty before the first sync */
	listSavedLogs: (folder: string) => Promise<LocalLog[]>;
	/** Create a folder and the folders it's in */
	createFolder: (folder: string) => Promise<void>;
	deleteLog: (folder: string, log: LocalLog) => Promise<void>;
	/**
	 * Copy the rest of `log` to `localPath` after the `offset` bytes already there.
	 * Returns the bytes copied, which is less than the rest of the log if it was cancelled.
	 */
	download: (
		host: string,
		log: RemoteLog,
		localPath: string,
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

/** A roboRIO or Systemcore, over SFTP in the desktop app */
export const robotBackend: SyncBackend = {
	listRobotLogs: (host) => invoke<RemoteLog[]>('list_robot_logs', { host }),
	listSavedLogs: (folder) => {
		const list = async (dir: string, depth: number): Promise<LocalLog[]> => {
			let entries;
			try {
				entries = await readDir(dir === '' ? folder : await join(folder, dir));
			} catch {
				// Not created until the first sync
				return [];
			}
			const nested = await Promise.all(
				entries.map(async ({ name, isFile, isDirectory }): Promise<LocalLog[]> => {
					const path = dir === '' ? name : `${dir}/${name}`;
					if (isFile && /\.(?:wpilog|wpilogxz|hoot)$/u.test(name)) {
						return [{ name, size: (await stat(await join(folder, path))).size, dir }];
					}
					// Runs are at most 3 folders deep, ex. `2027/CAPH/Q12`
					return isDirectory && depth < 3 ? list(path, depth + 1) : [];
				}),
			);
			return nested.flat();
		};
		return list('', 0);
	},
	createFolder: (folder) => mkdir(folder, { recursive: true }),
	deleteLog: async (folder, { dir, name }) => remove(await join(folder, dir, name)),
	download: (host, log, localPath, offset, onProgress) =>
		invoke<number>('download_robot_log', {
			host,
			remotePath: log.path,
			localPath,
			offset,
			onProgress: new Channel<number>(onProgress),
		}),
	cancelDownload: () => void invoke('cancel_robot_download'),
	disconnect: () => invoke('disconnect_robot'),
	watchRobotEnabled: async (host, onChange) => {
		const [{ watchRobotEnabled }, { openNt }] = await Promise.all([
			import('@/sync/robot-enabled'),
			import('@/nt/client'),
		]);
		return watchRobotEnabled(await openNt(host), onChange);
	},
};
