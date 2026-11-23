// Access to the video widgets' local files. Dashboards only save a file's name, so they can be shared, and each device
// keeps how to open it by pane: its path in the desktop app, or its file handle in Chromium browsers.
import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { get, set } from 'idb-keyval';
import { useEffect, useState } from 'react';
import * as z from 'zod';
import { supportsFileHandles } from '@/data/recent-logs';
import { createPersistedAtom } from '@/lib/persisted-store';

/** A pane's local video as the widget can play it */
export type LocalVideo =
	| { readonly state: 'loading' }
	| { readonly state: 'ready'; readonly url: string }
	/** The browser needs a click to read the file again */
	| { readonly state: 'allow'; readonly allow: () => void }
	/** The device can't open the file, ex. it was moved, or it's from someone else's dashboard */
	| { readonly state: 'missing' };

const videoExtensions = ['mp4', 'm4v', 'mov', 'webm', 'mkv', 'ogv', 'avi'];

/** Whether a dropped file is a video, by its type or extension since the OS doesn't always know the type */
export function isVideoFile(file: Pick<File, 'name' | 'type'>): boolean {
	return file.type.startsWith('video/') || videoExtensions.includes(file.name.split('.').at(-1)?.toLowerCase() ?? '');
}

// Files opened in this window, by pane, so they play without reading them again. The only way to open files the
// device can't keep access to, picked or dropped in browsers without file handles.
const sessionFiles = new Map<string, { name: string; url: string }>();

// Paths of the desktop app's videos, by pane
const desktopPaths = createPersistedAtom(
	'video-paths',
	z.record(z.string(), z.object({ name: z.string(), path: z.string() })).catch({}),
	{},
);

// Handles can't be saved to localStorage, but IndexedDB can store them
const handlesKey = 'doglog-studio:video-handles';
type SavedHandles = Record<string, { name: string; handle: FileSystemFileHandle }>;

/** Changes whenever a pane's file changes, so widgets open it again */
const version = createAtom(0);
const changed = () => version.set((value) => value + 1);

/** Keep a file open for the session, returns its URL */
function keepInSession(paneId: string, file: File): string {
	const previous = sessionFiles.get(paneId);
	if (previous) {
		URL.revokeObjectURL(previous.url);
	}
	// Revoked when the pane's file is replaced, files are kept for the session so they play without being opened again
	// react-doctor-disable-next-line react-doctor/no-create-object-url-without-revoke -- See above
	const url = URL.createObjectURL(file);
	sessionFiles.set(paneId, { name: file.name, url });
	return url;
}

function openInSession(paneId: string, file: File): void {
	keepInSession(paneId, file);
	changed();
}

async function saveHandle(paneId: string, handle: FileSystemFileHandle): Promise<void> {
	const handles = (await get<SavedHandles>(handlesKey)) ?? {};
	await set(handlesKey, { ...handles, [paneId]: { name: handle.name, handle } });
}

/** Open a handle's file in the session, `undefined` if it was moved or deleted */
async function openHandle(paneId: string, handle: FileSystemFileHandle): Promise<string | undefined> {
	try {
		return keepInSession(paneId, await handle.getFile());
	} catch {
		return undefined;
	}
}

/** The desktop app's video for a pane, after letting the webview read the file, `undefined` if it isn't there */
async function desktopVideo(paneId: string, name: string): Promise<LocalVideo | undefined> {
	const saved = desktopPaths.get()[paneId];
	if (saved?.name !== name) {
		return undefined;
	}
	try {
		await invoke('allow_video', { path: saved.path });
	} catch {
		return undefined;
	}
	return { state: 'ready', url: convertFileSrc(saved.path) };
}

async function handleVideo(paneId: string, name: string): Promise<LocalVideo | undefined> {
	const saved = (await get<SavedHandles>(handlesKey))?.[paneId];
	if (saved?.name !== name) {
		return undefined;
	}
	const permission = await saved.handle.queryPermission({ mode: 'read' });
	if (permission === 'granted') {
		const url = await openHandle(paneId, saved.handle);
		return url === undefined ? undefined : { state: 'ready', url };
	}
	return permission === 'prompt'
		? {
				state: 'allow',
				// Finds the file again once it's allowed
				allow: () => void saved.handle.requestPermission({ mode: 'read' }).then(changed),
			}
		: undefined;
}

async function findVideo(paneId: string, name: string): Promise<LocalVideo> {
	const session = sessionFiles.get(paneId);
	if (session?.name === name) {
		return { state: 'ready', url: session.url };
	}
	const found = STUDIO_DESKTOP
		? await desktopVideo(paneId, name)
		: supportsFileHandles
			? await handleVideo(paneId, name)
			: undefined;
	return found ?? { state: 'missing' };
}

/** A pane's local video file named `name`, as the widget can play it */
export function useLocalVideo(paneId: string, name: string): LocalVideo {
	const current = useSelector(version);
	const [video, setVideo] = useState<{ key: string; video: LocalVideo }>();
	const key = `${paneId}/${name}/${current}`;
	useEffect(() => {
		let stale = false;
		const load = async () => {
			const found = await findVideo(paneId, name);
			if (!stale) {
				setVideo({ key, video: found });
			}
		};
		void load();
		return () => {
			stale = true;
		};
	}, [paneId, name, key]);
	return video?.key === key ? video.video : { state: 'loading' };
}

function pickWithInput(): Promise<File | undefined> {
	return new Promise((resolve) => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'video/*';
		input.addEventListener('change', () => resolve(input.files?.[0]));
		input.addEventListener('cancel', () => resolve(undefined));
		input.click();
	});
}

/** Let the user pick a video file for a pane. Returns its name, `undefined` if they cancel. Call it during a click. */
export async function chooseVideoFile(paneId: string): Promise<string | undefined> {
	if (STUDIO_DESKTOP) {
		const path = await openDialog({ filters: [{ name: 'Video', extensions: videoExtensions }] });
		return path === null ? undefined : setVideoPath(paneId, path);
	}

	if (supportsFileHandles) {
		let handles: FileSystemFileHandle[];
		try {
			handles = await window.showOpenFilePicker!({
				types: [{ description: 'Video', accept: { 'video/*': videoExtensions.map((extension) => `.${extension}`) } }],
			});
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				return undefined;
			}
			throw error;
		}
		const handle = handles[0]!;
		await saveHandle(paneId, handle);
		await openHandle(paneId, handle);
		changed();
		return handle.name;
	}

	const file = await pickWithInput();
	if (file) {
		openInSession(paneId, file);
	}
	return file?.name;
}

/** Use a video file dropped on a pane, returns its name. Get `handle` while the drop event is handled. */
export function dropVideoFile(
	paneId: string,
	file: File,
	handle: Promise<FileSystemHandle | null> | undefined,
): string {
	openInSession(paneId, file);
	void saveDroppedHandle(paneId, handle);
	return file.name;
}

async function saveDroppedHandle(paneId: string, handle: Promise<FileSystemHandle | null> | undefined): Promise<void> {
	const resolved = await handle;
	if (resolved instanceof FileSystemFileHandle) {
		await saveHandle(paneId, resolved);
	}
}

/** Use a video file at `path` in the desktop app, returns its name */
export function setVideoPath(paneId: string, path: string): string {
	const name = path.split(/[/\\]/u).at(-1)!;
	desktopPaths.set((paths) => ({ ...paths, [paneId]: { name, path } }));
	const session = sessionFiles.get(paneId);
	if (session) {
		URL.revokeObjectURL(session.url);
		sessionFiles.delete(paneId);
	}
	changed();
	return name;
}

/** Whether text is an absolute path to a file, ex. `/Users/me/qual12.mp4` or `C:\Videos\qual12.mp4` */
export function isAbsolutePath(text: string): boolean {
	return /^(?:\/|[a-z]:[/\\]|\\\\)/iu.test(text);
}
