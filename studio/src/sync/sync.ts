// oxlint-disable no-await-in-loop -- Sync does one thing at a time, to keep the load on the roboRIO low
import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
import { invoke } from '@tauri-apps/api/core';
import { documentDir, join } from '@tauri-apps/api/path';
import { getRobotHost } from '@/robot-target';
import { settingsStore } from '@/settings';
import { type RobotEnabledWatcher, type SyncBackend, robotBackend } from '@/sync/backend';
import { demoBackend } from '@/sync/demo';
import { type LocalLog, type PlannedLog, type RemoteLog, type SyncFilter, planSync } from '@/sync/plan';
import { syncSettingsStore } from '@/sync/sync-settings';

export type SyncStatus =
	/** The user paused sync, or hasn't started it yet */
	| { type: 'paused' }
	| { type: 'no-robot' }
	/** Another Studio window is syncing */
	| { type: 'other-window' }
	| { type: 'waiting'; host: string; error: string | undefined }
	/** The robot is enabled, or was just disabled */
	| { type: 'robot-enabled' }
	| {
			type: 'syncing';
			file: string;
			fileNumber: number;
			fileCount: number;
			/** Bytes of the current file that are saved */
			fileSaved: number;
			/** Bytes copied of every file being copied */
			copied: number;
			total: number;
			/** Estimate of how long until every file is copied, `undefined` until there's enough progress to tell */
			secondsLeft: number | undefined;
	  }
	| { type: 'up-to-date' }
	| { type: 'error'; message: string };

/** The sync folder and the logs in it, including ones sync didn't download */
export interface SyncFolder {
	path: string;
	logs: LocalLog[];
}

const reconnectDelay = 5000;
const checkDelay = 10_000;
const bytesPerGb = 1_000_000_000;
/** How often to show copying progress, slower than the numbers' animation so it settles between updates */
const progressInterval = 500;
const estimateAfter = 2000;

const statusStore = createAtom<SyncStatus>({ type: 'paused' });
const folderStore = createAtom<SyncFolder | undefined>(undefined);
export interface PlannedLogs {
	/** Logs from the last time sync checked the robot, newest first */
	logs: PlannedLog[];
	/** When sync checked, from `Date.now()` */
	at: number;
}

const plannedStore = createAtom<PlannedLogs>({ logs: [], at: 0 });
let wake: () => void = () => {};
let robotEnabled: { host: string; backend: SyncBackend; watcher: RobotEnabledWatcher } | undefined;

const currentBackend = (): SyncBackend => (syncSettingsStore.get().demo ? demoBackend : robotBackend);

export function useSyncStatus(): SyncStatus {
	return useSelector(statusStore);
}

export function useSyncFolder(): SyncFolder | undefined {
	return useSelector(folderStore);
}

export function usePlannedLogs(): PlannedLogs {
	return useSelector(plannedStore);
}

/** Check the robot for new logs now instead of waiting for the next check */
export function syncNow(): void {
	wake();
}

/** Wait `ms` milliseconds, or until something sync depends on changes */
async function sleep(ms: number): Promise<void> {
	await new Promise<void>((resolve) => {
		const timer = Number.isFinite(ms) ? setTimeout(resolve, ms) : undefined;
		wake = () => {
			clearTimeout(timer);
			resolve();
		};
	});
	wake = () => {};
}

async function refreshFolder(): Promise<SyncFolder> {
	const { folder: picked, enabled, started } = syncSettingsStore.get();
	const path = picked ?? (await join(await documentDir(), 'DogLog', 'Logs'));
	const folder = { path, logs: enabled || started ? await currentBackend().listSavedLogs(path) : [] };
	folderStore.set(folder);
	return folder;
}

/** Follow whether the robot at `host` is enabled, or stop following when `host` is `undefined` */
async function watchRobot(host: string | undefined): Promise<void> {
	const backend = currentBackend();
	if (robotEnabled?.host === host && robotEnabled?.backend === backend) {
		return;
	}
	robotEnabled?.watcher.stop();
	robotEnabled = undefined;
	if (host !== undefined) {
		const watcher = await backend.watchRobotEnabled(host, () => {
			if (robotEnabled?.watcher.pausedFor() !== 0) {
				// Stop the current download right away so it doesn't slow down the robot
				backend.cancelDownload();
			}
			wake();
		});
		robotEnabled = { host, backend, watcher };
	}
}

function currentFilter(): SyncFilter {
	const { days, officialOnly, capGb } = syncSettingsStore.get();
	return { days, officialOnly, capBytes: capGb === null ? undefined : capGb * bytesPerGb };
}

const isRobotEnabled = () => (robotEnabled?.watcher.pausedFor() ?? 0) > 0;
const isPaused = () => !syncSettingsStore.get().enabled || isRobotEnabled();

/** Tauri commands reject with the message, other code throws `Error`s */
const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Show the logs that are already synced, before sync checks the robot */
async function showSavedLogs(): Promise<void> {
	const now = Date.now();
	plannedStore.set({ logs: planSync([], (await refreshFolder()).logs, currentFilter(), now).logs, at: now });
}

/** Copy new logs from the robot and delete old ones past the storage limit. Returns how long to wait before the next sync. */
async function syncOnce(host: string): Promise<number> {
	const backend = currentBackend();
	// Stop when sync is paused, or switches to or from demo mode
	const stopped = () => isPaused() || currentBackend() !== backend;
	if (!['syncing', 'up-to-date', 'error'].includes(statusStore.get().type)) {
		statusStore.set({ type: 'waiting', host, error: undefined });
	}

	let remoteLogs: RemoteLog[];
	try {
		remoteLogs = await backend.listRobotLogs(host);
	} catch (error) {
		statusStore.set({ type: 'waiting', host, error: errorMessage(error) });
		return reconnectDelay;
	}

	try {
		const folder = await refreshFolder();
		await backend.createFolder(folder.path);
		const now = Date.now();
		const plan = planSync(remoteLogs, folder.logs, currentFilter(), now);
		plannedStore.set({ logs: plan.logs, at: now });

		await Promise.all(plan.deletions.map((name) => backend.deleteLog(folder.path, name)));
		if (plan.deletions.length > 0) {
			await refreshFolder();
		}

		let total = plan.downloads.reduce((sum, { log, offset }) => sum + log.size - offset, 0);
		const startedAt = Date.now();
		const secondsLeft = (copied: number, of: number) => {
			const elapsed = Date.now() - startedAt;
			return elapsed < estimateAfter || copied === 0 ? undefined : (of - copied) / (copied / elapsed) / 1000;
		};
		let done = 0;
		for (const [index, { log, offset }] of plan.downloads.entries()) {
			if (stopped()) {
				return 0;
			}

			const status = {
				type: 'syncing',
				file: log.name,
				fileNumber: index + 1,
				fileCount: plan.downloads.length,
			} as const;
			const before = done;
			const totalBefore = total;
			const expected = log.size - offset;
			const progressStatus = (progress: number) => {
				// A log the robot is still writing can grow while it's copied
				const grownTotal = totalBefore + Math.max(progress - expected, 0);
				return {
					...status,
					fileSaved: offset + progress,
					copied: before + progress,
					total: grownTotal,
					secondsLeft: secondsLeft(before + progress, grownTotal),
				};
			};
			statusStore.set(progressStatus(0));
			let shownAt = Date.now();
			const copied = await backend.download(host, log, folder.path, offset, (progress) => {
				if (Date.now() - shownAt >= progressInterval) {
					shownAt = Date.now();
					statusStore.set(progressStatus(progress));
				}
			});
			done += copied;
			total += Math.max(copied - expected, 0);
			await refreshFolder();
			if (copied < expected && stopped()) {
				// Cancelled because the robot was enabled or the user paused sync, the rest is copied once it resumes
				return 0;
			}
		}
	} catch (error) {
		statusStore.set({ type: 'error', message: errorMessage(error) });
		return checkDelay;
	}

	statusStore.set({ type: 'up-to-date' });
	return checkDelay;
}

/** Sync logs from the robot whenever sync is turned on, for as long as Studio is open. Only call this in the desktop app. */
export async function runLogSync(): Promise<void> {
	let demo = syncSettingsStore.get().demo;
	syncSettingsStore.subscribe((settings) => {
		if (!settings.enabled || settings.demo !== demo) {
			robotBackend.cancelDownload();
			demoBackend.cancelDownload();
		}
		if (settings.demo === demo) {
			void refreshFolder();
		} else {
			demo = settings.demo;
			void showSavedLogs();
		}
		wake();
	});
	settingsStore.subscribe(() => wake());
	await showSavedLogs();

	// Only one Studio process syncs, so two can't write to the same log at once
	while (!(await invoke<boolean>('lock_sync'))) {
		statusStore.set({ type: 'other-window' });
		await sleep(reconnectDelay);
		await refreshFolder();
	}

	for (;;) {
		const { enabled, demo: inDemo } = syncSettingsStore.get();
		const host = inDemo ? 'the demo robot' : getRobotHost(settingsStore.get().robotTarget);
		await watchRobot(enabled ? host : undefined);

		let delay;
		if (!enabled) {
			statusStore.set({ type: 'paused' });
			await currentBackend().disconnect();
			delay = Number.POSITIVE_INFINITY;
		} else if (host === undefined) {
			statusStore.set({ type: 'no-robot' });
			delay = Number.POSITIVE_INFINITY;
		} else if (isRobotEnabled()) {
			statusStore.set({ type: 'robot-enabled' });
			delay = robotEnabled!.watcher.pausedFor();
		} else {
			delay = await syncOnce(host);
		}
		await sleep(delay);
	}
}
