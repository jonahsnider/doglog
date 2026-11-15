import { useRender } from '@base-ui/react/use-render';
import { isTauri } from '@tauri-apps/api/core';
import { Menu, type MenuItemOptions, type PredefinedMenuItemOptions, type SubmenuOptions } from '@tauri-apps/api/menu';
import { type HotkeyChord, useFormatForDisplay } from '@tanstack/react-hotkeys';
import type { LucideIcon } from 'lucide-react';
import type { MouseEvent, ReactElement, ReactNode } from 'react';
import {
	ContextMenu,
	ContextMenuItem,
	ContextMenuPopup,
	ContextMenuSeparator,
	ContextMenuShortcut,
	ContextMenuSub,
	ContextMenuSubPopup,
	ContextMenuSubTrigger,
	ContextMenuTrigger,
} from '@/components/ui/context-menu';

type MenuAction = {
	label: string;
	/** Only shown on the web */
	icon?: LucideIcon;
	shortcut?: HotkeyChord;
	disabled?: boolean;
	/** Only styled on the web */
	destructive?: boolean;
	onSelect: () => void;
};

type Submenu = {
	label: string;
	/** Only shown on the web */
	icon?: LucideIcon;
	disabled?: boolean;
	items: readonly MenuEntry[];
};

/** An item in a context menu definition */
export type MenuEntry = MenuAction | Submenu | 'separator';

type AppContextMenuProps = {
	items: readonly MenuEntry[];
	/** The element that opens the menu when right-clicked, it's rendered with `children` */
	render: ReactElement;
	children?: ReactNode;
	/** Shows the browser's own context menu instead */
	disabled?: boolean;
};

function WebMenuEntries({ items }: { items: readonly MenuEntry[] }) {
	const formatForDisplay = useFormatForDisplay();

	return items.map((item, index, all) => {
		if (item === 'separator') {
			const previous = all[index - 1];
			return <ContextMenuSeparator key={`after ${typeof previous === 'object' ? previous.label : ''}`} />;
		}

		const icon = item.icon && <item.icon />;
		if ('items' in item) {
			return (
				<ContextMenuSub key={item.label}>
					<ContextMenuSubTrigger disabled={item.disabled ?? false}>
						{icon}
						{item.label}
					</ContextMenuSubTrigger>
					<ContextMenuSubPopup>
						<WebMenuEntries items={item.items} />
					</ContextMenuSubPopup>
				</ContextMenuSub>
			);
		}

		return (
			<ContextMenuItem
				key={item.label}
				disabled={item.disabled ?? false}
				variant={item.destructive === true ? 'destructive' : 'default'}
				onClick={item.onSelect}
			>
				{icon}
				{item.label}
				{item.shortcut !== undefined && <ContextMenuShortcut>{formatForDisplay(item.shortcut)}</ContextMenuShortcut>}
			</ContextMenuItem>
		);
	});
}

function WebContextMenu({ items, render, children, disabled = false }: AppContextMenuProps) {
	return (
		<ContextMenu disabled={disabled}>
			<ContextMenuTrigger render={render}>{children}</ContextMenuTrigger>
			<ContextMenuPopup align="start" side="bottom" sideOffset={0}>
				<WebMenuEntries items={items} />
			</ContextMenuPopup>
		</ContextMenu>
	);
}

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

		return {
			text: item.label,
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

async function popUpNativeMenu(items: readonly MenuEntry[]): Promise<void> {
	const menu = await Menu.new({ items: toNativeEntries(items) });
	void lastNativeMenu?.close();
	lastNativeMenu = menu;
	await menu.popup();
}

function NativeContextMenu({ items, render, children, disabled = false }: AppContextMenuProps) {
	return useRender({
		render,
		props: {
			children,
			onContextMenu: (event: MouseEvent) => {
				if (disabled) {
					return;
				}

				event.preventDefault();
				event.stopPropagation();
				void popUpNativeMenu(items);
			},
		},
	});
}

/** A right-click menu for `render`, a native menu in the desktop app and a coss menu on the web */
export const AppContextMenu = isTauri() ? NativeContextMenu : WebContextMenu;
