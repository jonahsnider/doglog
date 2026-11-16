import { useRender } from '@base-ui/react/use-render';
import { isTauri } from '@tauri-apps/api/core';
import { Menu, type MenuItemOptions, type PredefinedMenuItemOptions, type SubmenuOptions } from '@tauri-apps/api/menu';
import { type HotkeyChord, useFormatForDisplay } from '@tanstack/react-hotkeys';
import { type MouseEvent, type ReactElement, type ReactNode, useEffect, useState } from 'react';
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
	shortcut?: HotkeyChord;
	/** A single key that selects the item while its submenu is open, ex. `S` */
	accessKey?: string;
	disabled?: boolean;
	/** Only styled on the web */
	destructive?: boolean;
	onSelect: () => void;
};

type Submenu = {
	label: string;
	disabled?: boolean;
	items: readonly MenuEntry[];
};

/** An item in a context menu definition */
export type MenuEntry = MenuAction | Submenu | 'separator';

type AppContextMenuProps = {
	/** Or a function of the right-clicked element, for menus that depend on what's under the pointer */
	items: readonly MenuEntry[] | ((target: Element) => readonly MenuEntry[]);
	/** The element that opens the menu when right-clicked, it's rendered with `children` */
	render: ReactElement;
	children?: ReactNode;
	/** Shows the browser's own context menu instead */
	disabled?: boolean;
};

/** Selects a submenu's items by their access keys, while it's mounted */
function AccessKeys({ items, close }: { items: readonly MenuEntry[]; close: () => void }) {
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.metaKey || event.ctrlKey || event.altKey) {
				return;
			}

			const item = items.find(
				(other): other is MenuAction =>
					typeof other === 'object' &&
					!('items' in other) &&
					!(other.disabled ?? false) &&
					other.accessKey?.toLowerCase() === event.key.toLowerCase(),
			);
			if (item) {
				// Captured, so the menu's typeahead and the app's shortcuts don't also handle it
				event.preventDefault();
				event.stopPropagation();
				close();
				item.onSelect();
			}
		};

		window.addEventListener('keydown', onKeyDown, { capture: true });
		return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
	}, [items, close]);

	return null;
}

function WebMenuEntries({ items, close }: { items: readonly MenuEntry[]; close: () => void }) {
	const formatForDisplay = useFormatForDisplay();

	return items.map((item, index, all) => {
		if (item === 'separator') {
			const previous = all[index - 1];
			return <ContextMenuSeparator key={`after ${typeof previous === 'object' ? previous.label : ''}`} />;
		}

		if ('items' in item) {
			return (
				<ContextMenuSub key={item.label}>
					<ContextMenuSubTrigger disabled={item.disabled ?? false}>{item.label}</ContextMenuSubTrigger>
					<ContextMenuSubPopup>
						<AccessKeys items={item.items} close={close} />
						<WebMenuEntries items={item.items} close={close} />
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
				{item.label}
				{item.shortcut === undefined ? (
					item.accessKey !== undefined && <ContextMenuShortcut>{item.accessKey.toUpperCase()}</ContextMenuShortcut>
				) : (
					<ContextMenuShortcut>{formatForDisplay(item.shortcut)}</ContextMenuShortcut>
				)}
			</ContextMenuItem>
		);
	});
}

function WebContextMenu({ items, render, children, disabled = false }: AppContextMenuProps) {
	const [target, setTarget] = useState<Element>();
	const [open, setOpen] = useState(false);
	const close = () => setOpen(false);

	return (
		<ContextMenu disabled={disabled} open={open} onOpenChange={setOpen}>
			<ContextMenuTrigger
				render={render}
				onContextMenu={(event) => setTarget(event.target instanceof Element ? event.target : event.currentTarget)}
			>
				{children}
			</ContextMenuTrigger>
			<ContextMenuPopup align="start" side="bottom" sideOffset={0}>
				<WebMenuEntries items={typeof items === 'function' ? (target ? items(target) : []) : items} close={close} />
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
				void popUpNativeMenu(
					typeof items === 'function'
						? items(event.target instanceof Element ? event.target : event.currentTarget)
						: items,
				);
			},
		},
	});
}

/** A right-click menu for `render`, a native menu in the desktop app and a coss menu on the web */
export const AppContextMenu = isTauri() ? NativeContextMenu : WebContextMenu;
