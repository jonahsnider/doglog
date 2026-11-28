// A video's `doglog.json` file and poster in the team's storage, see the log-storage spec's video files
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { type StorageClient, StorageError } from '@/storage/client';
import { joinPath } from '@/storage/connection';
import { encodeJson, posterPath, sidecarPath, videoFileSchema } from '@/storage/format';

/** A local video file, from a path in the desktop app or a chosen file in the web app */
export type LocalVideoFile = { localPath?: string; file?: File };

const posterWidth = 640;

/** A URL the page can load a local video from, and how to let it go */
async function localUrl(video: LocalVideoFile): Promise<{ url: string; release: () => void }> {
	if (video.file) {
		// react-doctor-disable-next-line react-doctor/no-create-object-url-without-revoke -- Revoked by `release()`
		const url = URL.createObjectURL(video.file);
		return { url, release: () => URL.revokeObjectURL(url) };
	}
	await invoke('allow_video', { path: video.localPath });
	return { url: convertFileSrc(video.localPath!), release: () => {} };
}

/** A video's length in seconds and a JPEG frame from it, `undefined` parts when the webview can't play it */
export async function inspectVideo(
	video: LocalVideoFile,
): Promise<{ duration?: number; poster?: Uint8Array<ArrayBuffer> }> {
	const { url, release } = await localUrl(video);
	const element = document.createElement('video');
	element.muted = true;
	element.preload = 'auto';
	element.crossOrigin = 'anonymous';
	try {
		await new Promise<void>((resolve, reject) => {
			element.addEventListener('loadedmetadata', () => resolve(), { once: true });
			element.addEventListener('error', () => reject(new Error("Couldn't read the video")), { once: true });
			element.src = url;
		});
		const duration = Number.isFinite(element.duration) ? element.duration : undefined;
		// A little way in, past a black first frame. WebKit draws black until the frame is presented, which is later than
		// `seeked`, and a window that isn't shown may never present it, so that's left without a poster.
		const presented = await new Promise<boolean>((resolve) => {
			const timeout = setTimeout(() => resolve(false), 5000);
			element.requestVideoFrameCallback(() => {
				clearTimeout(timeout);
				resolve(true);
			});
			element.currentTime = Math.min(10, (duration ?? 0) / 2);
		});
		if (!presented) {
			return { duration };
		}
		const canvas = document.createElement('canvas');
		canvas.width = posterWidth;
		canvas.height = Math.round((posterWidth * element.videoHeight) / Math.max(element.videoWidth, 1));
		canvas.getContext('2d')!.drawImage(element, 0, 0, canvas.width, canvas.height);
		const blob = await new Promise<Blob | null>((resolve) => {
			canvas.toBlob(resolve, 'image/jpeg', 0.8);
		});
		return { duration, poster: blob ? new Uint8Array(await blob.arrayBuffer()) : undefined };
	} catch {
		return {};
	} finally {
		element.removeAttribute('src');
		element.load();
		release();
	}
}

async function readSidecar(storage: StorageClient, path: string): Promise<Record<string, unknown>> {
	try {
		const parsed: unknown = JSON.parse(new TextDecoder().decode(await storage.read(path)));
		return typeof parsed === 'object' && parsed !== null ? Object.fromEntries(Object.entries(parsed)) : {};
	} catch (error) {
		if (error instanceof StorageError && (error.status === 404 || error.message.includes("doesn't exist"))) {
			return {};
		}
		throw error;
	}
}

/** Change a video's `doglog.json` file, keeping fields Studio doesn't know */
export async function updateSidecar(
	storage: StorageClient,
	sidecar: string,
	changes: { angle?: string; offset?: number; youtube?: string },
): Promise<void> {
	const existing = await readSidecar(storage, sidecar);
	const next = { ...videoFileSchema.parse(existing), ...existing, ...changes, version: 1 };
	await storage.write(sidecar, encodeJson(next), 'application/json');
}

/** Write an uploaded video's `doglog.json` file, and a frame from it as its poster */
export async function writeVideoFiles(
	storage: StorageClient,
	path: string,
	info: { angle: string; offset: number },
	video: LocalVideoFile,
): Promise<void> {
	await updateSidecar(storage, sidecarPath(path), info);
	const { poster } = await inspectVideo(video);
	if (poster) {
		await storage.write(posterPath(path), poster, 'image/jpeg');
	}
}

/**
 * Link a video in storage to a run: move it, its poster, and its `doglog.json` file into the run's folder, and save its
 * angle and sync. A YouTube video only has its `doglog.json` file.
 */
export async function moveVideo(
	storage: StorageClient,
	video: { file?: string; poster?: string; sidecar?: string },
	folder: string,
	info: { angle: string; offset: number },
): Promise<void> {
	const into = (path: string) => joinPath(folder, path.split('/').at(-1)!);
	let sidecar = video.sidecar;
	if (video.file !== undefined) {
		const moved = into(video.file);
		if (moved !== video.file) {
			await storage.rename(video.file, moved);
			if (video.poster !== undefined) {
				await storage.rename(video.poster, posterPath(moved));
			}
			if (video.sidecar !== undefined) {
				await storage.rename(video.sidecar, sidecarPath(moved));
			}
		}
		sidecar = sidecarPath(moved);
	} else if (sidecar !== undefined && into(sidecar) !== sidecar) {
		await storage.rename(sidecar, into(sidecar));
		sidecar = into(sidecar);
	}
	if (sidecar !== undefined) {
		await updateSidecar(storage, sidecar, info);
	}
}
