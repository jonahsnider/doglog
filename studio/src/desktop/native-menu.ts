import type { LogicalPosition } from '@tauri-apps/api/dpi';
import {
	type CheckMenuItemOptions,
	Menu,
	type MenuItemOptions,
	type PredefinedMenuItemOptions,
	Submenu,
	type SubmenuOptions,
} from '@tauri-apps/api/menu';
import type { MenuEntry } from '@/components/app-context-menu';
import { clearRecentLogs, recentLogLabels, recentLogsStore } from '@/data/recent-logs';
import { openLogPath } from '@/data/open-log';

type NativeMenuEntry = MenuItemOptions | CheckMenuItemOptions | SubmenuOptions | PredefinedMenuItemOptions;

function toNativeEntries(items: readonly MenuEntry[]): NativeMenuEntry[] {
	return items.map((item): NativeMenuEntry => {
		if (item === 'separator') {
			return { item: 'Separator' };
		}

		if ('checked' in item) {
			return { text: item.label, checked: item.checked, action: () => item.onCheckedChange(!item.checked) };
		}

		const enabled = !(item.disabled ?? false);
		if ('items' in item) {
			return { text: item.label, enabled, items: toNativeEntries(item.items) };
		}

		const accessKeyIndex =
			item.accessKey === undefined ? -1 : item.label.toLowerCase().indexOf(item.accessKey.toLowerCase());
		return {
			// `&` marks the access key as the item's mnemonic, macOS doesn't have mnemonics and ignores it
			text:
				accessKeyIndex === -1
					? item.label
					: `${item.label.slice(0, accessKeyIndex)}&${item.label.slice(accessKeyIndex)}`,
			enabled,
			action: item.onSelect,
			// macOS also invokes this item if the shortcut is pressed while the popup is open.
			...(item.shortcut !== undefined && {
				accelerator: item.shortcut.replace('Mod', 'CmdOrCtrl').replace('Meta', 'Super'),
			}),
			// Shows the access key like the web menu, and selects the item on macOS while the menu is open
			...(item.shortcut === undefined && item.accessKey !== undefined && { accelerator: item.accessKey }),
		};
	});
}

/** Kept until the next menu opens, some platforms send the chosen item's event after `popup()` resolves */
let lastNativeMenu: Menu | undefined;

/** Opens `items` as a native menu at `at`, or at the pointer */
export async function popUpNativeMenu(items: readonly MenuEntry[], at?: LogicalPosition): Promise<void> {
	const menu = await Menu.new({ items: toNativeEntries(items) });
	void lastNativeMenu?.close();
	lastNativeMenu = menu;
	await menu.popup(at);
}

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
