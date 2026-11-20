import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
import { invoke } from '@tauri-apps/api/core';
import { get, set } from 'idb-keyval';
import * as z from 'zod';
import { createPersistedAtom } from '@/lib/persisted-store';

const maxRecentLogs = 10;

/** Paths of the logs the desktop app opened most recently, newest first */
export const recentLogsStore = createPersistedAtom('recent-logs', z.array(z.string()).catch([]), []);

export function useRecentLogs(): readonly string[] {
	return useSelector(recentLogsStore);
}

/** A label for each path, the file name, or `folder/file.wpilog` when another log has the same name */
export function recentLogLabels(paths: readonly string[]): string[] {
	const names = paths.map((path) => path.split(/[/\\]/u).at(-1)!);
	return paths.map((path, index) => {
		const name = names[index]!;
		return names.indexOf(name) === names.lastIndexOf(name) ? name : path.split(/[/\\]/u).slice(-2).join('/');
	});
}

export function addRecentLog(path: string): void {
	recentLogsStore.set((paths) => [path, ...paths.filter((other) => other !== path)].slice(0, maxRecentLogs));
	// Also lists it in the Dock icon's menu on macOS and the jump list on Windows
	void invoke('note_recent_log', { path });
}

export function removeRecentLog(path: string): void {
	recentLogsStore.set((paths) => paths.filter((other) => other !== path));
}

export function clearRecentLogs(): void {
	recentLogsStore.set([]);
	if (STUDIO_DESKTOP) {
		void invoke('clear_recent_logs');
	}
	if (supportsFileHandles) {
		void saveRecentLogHandles([]);
	}
}

/** Whether the web app can keep access to opened files, so it can list recent logs. Only Chromium browsers can. */
export const supportsFileHandles = !STUDIO_DESKTOP && 'showOpenFilePicker' in globalThis;

// Handles can't be saved to localStorage, but IndexedDB can store them
const handlesKey = 'doglog-studio:recent-log-handles';

interface RecentLogHandle {
	/** Handles don't have an ID or path to tell them apart */
	id: string;
	handle: FileSystemFileHandle;
}

/** The logs the web app opened most recently, newest first */
const recentLogHandlesStore = createAtom<readonly RecentLogHandle[]>([]);

async function loadRecentLogHandles(): Promise<void> {
	recentLogHandlesStore.set((await get<RecentLogHandle[]>(handlesKey)) ?? []);
}

if (supportsFileHandles) {
	void loadRecentLogHandles();
	// Other tabs may have changed the list
	window.addEventListener('focus', () => void loadRecentLogHandles());
}

export function useRecentLogHandles(): readonly RecentLogHandle[] {
	return useSelector(recentLogHandlesStore);
}

async function otherHandles(handle: FileSystemFileHandle): Promise<RecentLogHandle[]> {
	const handles = (await get<RecentLogHandle[]>(handlesKey)) ?? [];
	const same = await Promise.all(handles.map((other) => other.handle.isSameEntry(handle)));
	return handles.filter((_, index) => same[index] === false);
}

async function saveRecentLogHandles(handles: readonly RecentLogHandle[]): Promise<void> {
	await set(handlesKey, handles);
	recentLogHandlesStore.set(handles);
}

export async function addRecentLogHandle(handle: FileSystemFileHandle): Promise<void> {
	const recent = { id: crypto.randomUUID(), handle };
	await saveRecentLogHandles([recent, ...(await otherHandles(handle))].slice(0, maxRecentLogs));
}

export async function removeRecentLogHandle(handle: FileSystemFileHandle): Promise<void> {
	await saveRecentLogHandles(await otherHandles(handle));
}
