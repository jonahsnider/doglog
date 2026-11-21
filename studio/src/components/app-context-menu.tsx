import { useRender } from '@base-ui/react/use-render';
import { type HotkeyChord, useFormatForDisplay } from '@tanstack/react-hotkeys';
import { type MouseEvent, type ReactElement, type ReactNode, useState } from 'react';
import { useEventListener } from 'usehooks-ts';
import {
	ContextMenu,
	ContextMenuCheckboxItem,
	ContextMenuItem,
	ContextMenuPopup,
	ContextMenuSeparator,
	ContextMenuShortcut,
	ContextMenuSub,
	ContextMenuSubPopup,
	ContextMenuSubTrigger,
	ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { popUpNativeMenu } from '@/desktop/native-menu';

export type MenuAction = {
	label: string;
	shortcut?: HotkeyChord;
	/** A single key that selects the item while its submenu is open, ex. `S` */
	accessKey?: string;
	disabled?: boolean;
	/** Only styled on the web */
	destructive?: boolean;
	onSelect: () => void;
};

/** Toggling it keeps the menu open on the web, native menus close */
export type MenuCheckbox = {
	label: string;
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
};

type Submenu = {
	label: string;
	disabled?: boolean;
	items: readonly MenuEntry[];
};

export type MenuEntry = MenuAction | MenuCheckbox | Submenu | 'separator';

type AppContextMenuProps = {
	/** Or a function of the right-clicked element, for menus that depend on what's under the pointer */
	items: readonly MenuEntry[] | ((target: Element) => readonly MenuEntry[]);
	/** The element that opens the menu when right-clicked, it's rendered with `children` */
	render: ReactElement;
	children?: ReactNode;
	/** Shows the browser's own context menu instead */
	disabled?: boolean;
	/** Only called on the web, native menus can't change while they're open */
	onOpenChange?: (open: boolean) => void;
};

/** Selects a submenu's items by their access keys, while it's mounted */
function AccessKeys({ items, close }: { items: readonly MenuEntry[]; close: () => void }) {
	// Capture so the menu's typeahead and the app's shortcuts don't also handle the key.
	useEventListener(
		'keydown',
		(event) => {
			if (event.metaKey || event.ctrlKey || event.altKey) {
				return;
			}

			const item = items.find(
				(other): other is MenuAction =>
					typeof other === 'object' &&
					'onSelect' in other &&
					!(other.disabled ?? false) &&
					other.accessKey?.toLowerCase() === event.key.toLowerCase(),
			);
			if (item) {
				event.preventDefault();
				event.stopPropagation();
				close();
				item.onSelect();
			}
		},
		undefined,
		true,
	);

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

		if ('checked' in item) {
			return (
				<ContextMenuCheckboxItem key={item.label} checked={item.checked} onCheckedChange={item.onCheckedChange}>
					{item.label}
				</ContextMenuCheckboxItem>
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

function WebContextMenu({ items, render, children, disabled = false, onOpenChange }: AppContextMenuProps) {
	const [target, setTarget] = useState<Element>();
	const [open, setOpen] = useState(false);
	const changeOpen = (newOpen: boolean) => {
		setOpen(newOpen);
		onOpenChange?.(newOpen);
	};
	const close = () => changeOpen(false);

	return (
		<ContextMenu disabled={disabled} open={open} onOpenChange={changeOpen}>
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
export const AppContextMenu = STUDIO_DESKTOP ? NativeContextMenu : WebContextMenu;
