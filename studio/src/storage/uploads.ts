// oxlint-disable max-lines -- Uploading from sync and from members, and sharing the status with other windows, use the same queue
// oxlint-disable no-await-in-loop -- Uploads go one at a time, so each gets the whole connection
// Uploads logs from the sync folder and files members add to the team's storage, see the log-sync spec's upload synced
// logs and the log-storage spec's upload logs and videos. In the desktop app one window uploads and the others show what
// it's doing, like sync. The web app uploads the files chosen in each tab while it stays open.
import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
import { invoke } from '@tauri-apps/api/core';
import { join } from '@tauri-apps/api/path';
import * as z from 'zod';
import { toastManager } from '@/components/toast';
import { createPersistedAtom } from '@/lib/persisted-store';
import type { ChosenFile } from '@/storage/choose-files';
import { type UploadSource, createStorage } from '@/storage/client';
import { joinPath } from '@/storage/connection';
import { type Listing, canReach, listingQuery, queryClient, refreshListing, storedLogs } from '@/storage/listing';
import { isAddable, isLogFileName, isVideoFile, unsortedFolder } from '@/storage/format';
import { addToRunFile, summarizeLog } from '@/storage/run-file';
import { writeVideoFiles } from '@/storage/video-files';
import { teamStorageStore } from '@/storage/team-storage';
import { parseLogName } from '@/sync/log-names';
import { runFolders } from '@/sync/runs';
import { type PlannedLogs, type SyncFolder, folderStore, plannedStore } from '@/sync/sync';
import { syncSettingsStore } from '@/sync/sync-settings';

export type UploadStatus =
	| { type: 'no-storage' }
	/** The web app can't reach the team's storage */
	| { type: 'desktop-only' }
	| { type: 'paused'; waiting: number }
	/** Storage can't be reached, ex. without internet at an event */
	| { type: 'offline'; waiting: number; error: string }
	| {
			type: 'uploading';
			name: string;
			/** Path in storage */
			path: string;
			uploaded: number;
			size: number;
			/** Files waiting after this one */
			waiting: number;
	  }
	| { type: 'up-to-date' }
	| { type: 'error'; message: string; waiting: number };

/** A file to upload */
interface Upload extends UploadSource {
	name: string;
	/** Path in storage */
	path: string;
	/** Whether it's a log, which is added to its run's `doglog.json` */
	log: boolean;
	/** Whether it's from the sync folder, rather than added by a member */
	synced: boolean;
	/** For a video, what its `doglog.json` file says, written with its poster once it's uploaded */
	video?: VideoInfo;
}

/** A video's angle and sync, see the log-storage spec's video files */
export interface VideoInfo {
	angle: string;
	offset: number;
}

const videoInfoSchema = z.object({ angle: z.string(), offset: z.number() }).optional();

/** Files added in the desktop app, kept until they're uploaded, including after Studio restarts. Shared by every window. */
const addedUploadsStore = createPersistedAtom(
	'storage-uploads',
	z.array(z.object({ localPath: z.string(), path: z.string(), size: z.number(), video: videoInfoSchema })).catch([]),
	[],
);
/** Files chosen in the web app, uploaded while the page stays open */
const webUploadsStore = createAtom<{ file: File; path: string; video?: VideoInfo }[]>([]);

const statusStore = createAtom<UploadStatus>({ type: 'no-storage' });

export function useUploadStatus(): UploadStatus {
	return useSelector(statusStore);
}

/** Upload chosen files to paths in the team's storage, with a video's angle and sync */
export function addUploads(files: readonly (ChosenFile & { path: string; video?: VideoInfo })[]) {
	const fromDisk = files.flatMap(({ path, size, video, ...file }) =>
		'localPath' in file ? [{ path, localPath: file.localPath, size, video }] : [],
	);
	const chosen = files.flatMap(({ path, video, ...file }) =>
		'file' in file ? [{ path, file: file.file, video }] : [],
	);
	if (fromDisk.length > 0) {
		addedUploadsStore.set((uploads) => [...uploads, ...fromDisk]);
	}
	if (chosen.length > 0) {
		webUploadsStore.set((uploads) => [...uploads, ...chosen]);
	}
}

/**
 * Uploads the logs among files a member added to the run folders their names call for, without asking, see the
 * log-storage spec's upload logs and videos. Returns the videos, which need their run and angle chosen first.
 */
export function uploadLogs(files: readonly ChosenFile[]): ChosenFile[] {
	const logs = files.filter((file) => isLogFileName(file.name));
	const folders = runFolders(logs.map((file) => file.name));
	addUploads(
		logs.map((file) =>
			Object.assign(file, {
				path: joinPath(folders.get(file.name) ?? unsortedFolder(new Date(file.modified)), file.name),
			}),
		),
	);
	if (files.some((file) => !isAddable(file.name))) {
		toastManager.add({
			type: 'error',
			title: 'Only logs and videos can be added to runs',
			description: 'Use Files to upload other files.',
		});
	}
	return files.filter((file) => isVideoFile(file.name));
}

const retryDelay = 30_000;
const checkDelay = 60_000;
let wake: () => void = () => {};
let controller = new AbortController();

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

const nameOf = (path: string) => path.split(/[/\\]/u).at(-1)!;
const parentOf = (path: string) => path.split('/').slice(0, -1).join('/');

/**
 * Logs in the sync folder to upload: finished ones, meaning the robot started a newer run and the copy has caught up,
 * that storage doesn't have at least as much of.
 */
function syncedLogUploads(folder: SyncFolder | undefined, planned: PlannedLogs, listing: Listing): Promise<Upload[]> {
	if (!folder) {
		return Promise.resolve([]);
	}
	const unfinished = new Set(planned.logs.filter((log) => log.state !== 'synced').map((log) => log.name));
	const names = [...folder.logs.map((log) => log.name), ...planned.logs.map((log) => log.name)];
	const runs = runFolders(names);
	const newest = names.toSorted(
		(a, b) => (parseLogName(b)?.date.getTime() ?? 0) - (parseLogName(a)?.date.getTime() ?? 0),
	)[0];
	const newestRun = newest === undefined ? undefined : runs.get(newest);
	const stored = storedLogs(listing);

	const logs = folder.logs.filter((log) => {
		const run = runs.get(log.name);
		return (
			run !== undefined &&
			run !== newestRun &&
			!unfinished.has(log.name) &&
			(stored.get(log.name)?.size ?? -1) < log.size
		);
	});
	return Promise.all(
		logs.map(async (log) => {
			const localPath = await join(folder.path, log.dir, log.name);
			return {
				id: `${localPath}:${log.size}`,
				name: log.name,
				size: log.size,
				localPath,
				// A smaller copy in storage is replaced where it is, in case someone moved it
				path: stored.get(log.name)?.path ?? `${log.dir === '' ? runs.get(log.name)! : log.dir}/${log.name}`,
				log: true,
				synced: true,
			};
		}),
	);
}

function addedUploads(): Upload[] {
	return [
		...addedUploadsStore.get().map(({ localPath, path, size, video }) => ({
			id: `${localPath}:${size}`,
			name: nameOf(localPath),
			size,
			localPath,
			path,
			log: isLogFileName(path),
			synced: false,
			video,
		})),
		...webUploadsStore.get().map(({ file, path, video }) => ({
			id: `${path}:${file.name}:${file.size}:${file.lastModified}`,
			name: file.name,
			size: file.size,
			file,
			path,
			log: isLogFileName(path),
			synced: false,
			video,
		})),
	];
}

function removeAdded(upload: Upload): void {
	if (upload.file) {
		webUploadsStore.set((uploads) => uploads.filter(({ file }) => file !== upload.file));
	} else {
		addedUploadsStore.set((uploads) =>
			uploads.filter(({ localPath, path }) => localPath !== upload.localPath || path !== upload.path),
		);
	}
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Add an uploaded log to its run's `doglog.json`, with a summary of a robot log */
async function updateRunFile(upload: Upload, storage: ReturnType<typeof createStorage>): Promise<void> {
	let summary;
	if (!upload.name.endsWith('.hoot')) {
		try {
			summary = await summarizeLog(
				upload.file
					? await upload.file.arrayBuffer()
					: await invoke<ArrayBuffer>('read_log', { path: upload.localPath }),
			);
		} catch {
			// The run file still lists the log, its summary is left out
		}
	}
	await addToRunFile(storage, parentOf(upload.path), upload.name, summary);
}

/** Upload what's waiting once, returns how long to wait before checking again */
async function uploadOnce(): Promise<number> {
	const team = teamStorageStore.get();
	if (!team) {
		statusStore.set({ type: 'no-storage' });
		return Number.POSITIVE_INFINITY;
	}
	if (!canReach(team.connection)) {
		statusStore.set({ type: 'desktop-only' });
		return Number.POSITIVE_INFINITY;
	}

	let listing: Listing;
	try {
		listing = await queryClient.query({ ...listingQuery(team.connection), staleTime: 5000 });
	} catch (error) {
		listing = { files: [], json: {}, at: 0, error: errorMessage(error) };
	}
	const uploads = [
		...addedUploads(),
		...(STUDIO_DESKTOP ? await syncedLogUploads(folderStore.get(), plannedStore.get(), listing) : []),
	];
	if (!syncSettingsStore.get().uploadsEnabled) {
		statusStore.set({ type: 'paused', waiting: uploads.length });
		return Number.POSITIVE_INFINITY;
	}
	if (listing.error !== undefined) {
		statusStore.set({ type: 'offline', waiting: uploads.length, error: listing.error });
		return retryDelay;
	}
	if (uploads.length === 0) {
		statusStore.set({ type: 'up-to-date' });
		return checkDelay;
	}

	const storage = createStorage(team.connection);
	controller = new AbortController();
	const { signal } = controller;
	for (const [index, upload] of uploads.entries()) {
		const status = { type: 'uploading', name: upload.name, path: upload.path, size: upload.size } as const;
		const waiting = uploads.length - index - 1;
		statusStore.set({ ...status, uploaded: 0, waiting });
		try {
			const done = await storage.upload(
				upload.path,
				upload,
				(uploaded) => statusStore.set({ ...status, uploaded, waiting }),
				signal,
			);
			if (!done) {
				return 0;
			}
			if (upload.log) {
				await updateRunFile(upload, storage);
			}
			if (upload.video) {
				await writeVideoFiles(storage, upload.path, upload.video, upload);
			}
			if (!upload.synced) {
				removeAdded(upload);
			}
		} catch (error) {
			if (signal.aborted) {
				return 0;
			}
			statusStore.set({ type: 'error', message: errorMessage(error), waiting: waiting + 1 });
			refreshListing();
			return retryDelay;
		} finally {
			refreshListing();
		}
	}
	// Check again right away, in case more is waiting
	return 0;
}

async function uploadLoop(): Promise<never> {
	for (;;) {
		await sleep(await uploadOnce());
	}
}

type Message = { type: 'hello' } | { type: 'state'; status: UploadStatus };

/** Upload to the team's storage for as long as Studio is open */
export async function runUploads(): Promise<void> {
	let enabled = syncSettingsStore.get().uploadsEnabled;
	syncSettingsStore.subscribe((settings) => {
		if (settings.uploadsEnabled !== enabled) {
			enabled = settings.uploadsEnabled;
			// Pausing stops the upload in progress right away
			controller.abort();
			wake();
		}
	});
	teamStorageStore.subscribe(() => wake());
	addedUploadsStore.subscribe(() => wake());
	webUploadsStore.subscribe(() => wake());
	folderStore.subscribe(() => wake());

	if (!STUDIO_DESKTOP) {
		await uploadLoop();
		return;
	}

	// One window uploads, the others show what it's doing
	const channel = new BroadcastChannel('doglog-studio:uploads');
	// oxlint-disable-next-line unicorn/require-post-message-target-origin -- Broadcast channels have no origin argument
	const post = (message: Message) => channel.postMessage(message);
	let uploading = false;
	channel.addEventListener('message', ({ data }: MessageEvent<Message>) => {
		if (data.type === 'state' && !uploading) {
			statusStore.set(data.status);
		} else if (data.type === 'hello' && uploading) {
			post({ type: 'state', status: statusStore.get() });
		}
	});
	post({ type: 'hello' });
	await navigator.locks.request('doglog-studio:uploads', async () => {
		uploading = true;
		statusStore.subscribe((status) => post({ type: 'state', status }));
		await uploadLoop();
	});
}
