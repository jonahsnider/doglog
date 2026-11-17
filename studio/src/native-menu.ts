import type { LogicalPosition } from '@tauri-apps/api/dpi';
import { Menu, type MenuItemOptions, type PredefinedMenuItemOptions, type SubmenuOptions } from '@tauri-apps/api/menu';
import type { MenuEntry } from '@/components/app-context-menu';

type NativeMenuEntry = MenuItemOptions | SubmenuOptions | PredefinedMenuItemOptions;

function toNativeEntries(items: readonly MenuEntry[]): NativeMenuEntry[] {
	return items.map((item): NativeMenuEntry => {
		if (item === 'separator') {
			return { item: 'Separator' };
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
			// Only shown, the shortcut itself is handled elsewhere
			...(item.shortcut !== undefined && {
				accelerator: item.shortcut.replace('Mod', 'CmdOrCtrl').replace('Meta', 'Super'),
			}),
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
