import { type MenuItemOptions, type PredefinedMenuItemOptions, Submenu } from '@tauri-apps/api/menu';
import { clearRecentLogs, recentLogLabels, recentLogsStore } from '@/data/recent-logs';
import { openLogPath } from '@/data/open-log';

function recentLogItems(paths: readonly string[]): (MenuItemOptions | PredefinedMenuItemOptions)[] {
	const labels = recentLogLabels(paths);
	return [
		...paths.map((path, index): MenuItemOptions => ({ text: labels[index]!, action: () => void openLogPath(path) })),
		...(paths.length > 0 ? [{ item: 'Separator' } as const] : []),
		{ text: 'Clear Menu', enabled: paths.length > 0, action: clearRecentLogs },
	];
}

/** Create the File > Open Recent menu, which follows the recent logs */
export async function createOpenRecentMenu(): Promise<Submenu> {
	const submenu = await Submenu.new({ text: 'Open Recent', items: recentLogItems(recentLogsStore.get()) });
	// One at a time, so quick changes don't mix their items
	let update = Promise.resolve();
	const replaceItems = async (paths: readonly string[]) => {
		const items = await submenu.items();
		await Promise.all(items.map((item) => submenu.remove(item)));
		await submenu.append(recentLogItems(paths));
	};
	recentLogsStore.subscribe((paths) => {
		update = update.then(() => replaceItems(paths));
	});
	return submenu;
}
