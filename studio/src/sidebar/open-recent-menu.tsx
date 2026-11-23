import { MenuItem, MenuSeparator, MenuSub, MenuSubPopup, MenuSubTrigger } from '@/components/ui/menu';
import { openLogPath, openRecentLogHandle } from '@/data/open-log';
import { clearRecentLogs, recentLogLabels, useRecentLogHandles, useRecentLogs } from '@/data/recent-logs';

export function OpenRecentMenu() {
	const savedPaths = useRecentLogs();
	// Only the desktop app can open paths, ignore any saved on the web
	const paths = STUDIO_DESKTOP ? savedPaths : [];
	const handles = useRecentLogHandles();
	const labels = recentLogLabels(paths);
	const empty = paths.length === 0 && handles.length === 0;
	return (
		<MenuSub>
			<MenuSubTrigger>Open recent</MenuSubTrigger>
			<MenuSubPopup className="max-w-80">
				{STUDIO_DESKTOP &&
					paths.map((path, index) => (
						<MenuItem key={path} title={path} onClick={() => void openLogPath(path)}>
							<span className="truncate">{labels[index]}</span>
						</MenuItem>
					))}
				{handles.map((recent) => (
					<MenuItem key={recent.id} onClick={() => void openRecentLogHandle(recent.handle)}>
						<span className="truncate">{recent.handle.name}</span>
					</MenuItem>
				))}
				{!empty && <MenuSeparator />}
				<MenuItem disabled={empty} onClick={clearRecentLogs}>
					Clear recent
				</MenuItem>
			</MenuSubPopup>
		</MenuSub>
	);
}
