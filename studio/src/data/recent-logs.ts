import { useSelector } from '@tanstack/react-store';
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
}

export function removeRecentLog(path: string): void {
	recentLogsStore.set((paths) => paths.filter((other) => other !== path));
}

export function clearRecentLogs(): void {
	recentLogsStore.set([]);
}
