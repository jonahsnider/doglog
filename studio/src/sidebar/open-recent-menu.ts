import type { MenuEntry } from '@/components/app-context-menu';
import { openLogPath, openRecentLogHandle } from '@/data/open-log';
import { clearRecentLogs, recentLogLabels, useRecentLogHandles, useRecentLogs } from '@/data/recent-logs';

/** The source menu's Open recent submenu */
export function useOpenRecentEntry(): MenuEntry {
	const savedPaths = useRecentLogs();
	// Only the desktop app can open paths, ignore any saved on the web
	const paths = STUDIO_DESKTOP ? savedPaths : [];
	const handles = useRecentLogHandles();
	const labels = recentLogLabels(paths);
	const empty = paths.length === 0 && handles.length === 0;
	return {
		label: 'Open recent',
		items: [
			...paths.map((path, index) => ({ label: labels[index]!, onSelect: () => void openLogPath(path) })),
			...handles.map((recent) => ({
				label: recent.handle.name,
				onSelect: () => void openRecentLogHandle(recent.handle),
			})),
			...(empty ? [] : ['separator' as const]),
			{ label: 'Clear recent', disabled: empty, onSelect: clearRecentLogs },
		],
	};
}
