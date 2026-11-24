import { type HotkeyChord, useFormatForDisplay } from '@tanstack/react-hotkeys';
import EllipsisIcon from 'lucide-react/icons/ellipsis';
import { type ComponentProps, type ReactElement, type ReactNode, useState } from 'react';
import { useEventListener } from 'usehooks-ts';
import { ControlTooltip } from '@/components/control-tooltip';
import { ContextMenu, ContextMenuPopup, ContextMenuTrigger } from '@/components/ui/context-menu';
import {
	Menu,
	MenuCheckboxItem,
	MenuItem,
	MenuPopup,
	MenuRadioGroup,
	MenuRadioItem,
	MenuSeparator,
	MenuShortcut,
	MenuSub,
	MenuSubPopup,
	MenuSubTrigger,
	MenuTrigger,
} from '@/components/ui/menu';

export type MenuAction = {
	label: string;
	shortcut?: HotkeyChord;
	/** A single key that selects the item while its submenu is open, ex. `S` */
	accessKey?: string;
	disabled?: boolean;
	onSelect: () => void;
};

/** Toggling it keeps the menu open, unless it's one of several choices that `closeOnClick` */
export type MenuCheckbox = {
	label: string;
	checked: boolean;
	closeOnClick?: boolean;
	onCheckedChange: (checked: boolean) => void;
};

type Submenu = {
	label: string;
	disabled?: boolean;
} & (
	| { items: readonly MenuEntry[] }
	| {
			choices: readonly { value: string; label: string; icon?: ReactNode }[];
			value: string | null;
			onValueChange: (value: string) => void;
	  }
);

export type MenuEntry = MenuAction | MenuCheckbox | Submenu | 'separator';
export type MenuPoint = Readonly<Pick<MouseEvent, 'clientX' | 'clientY'>>;

type AppContextMenuProps = {
	/** Or a function of the right-clicked element, for menus that depend on what's under the pointer */
	items: readonly MenuEntry[] | ((target: Element, point?: MenuPoint) => readonly MenuEntry[]);
	/** The element that opens the menu when right-clicked, it's rendered with `children` */
	render: ReactElement;
	children?: ReactNode;
	/** Shows the browser's own context menu instead */
	disabled?: boolean;
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

function MenuEntries({ items, close }: { items: readonly MenuEntry[]; close: () => void }) {
	const formatForDisplay = useFormatForDisplay();

	return items.map((item, index, all) => {
		if (item === 'separator') {
			const previous = all[index - 1];
			return <MenuSeparator key={`after ${typeof previous === 'object' ? previous.label : ''}`} />;
		}

		if ('items' in item || 'choices' in item) {
			return (
				<MenuSub key={item.label}>
					<MenuSubTrigger disabled={item.disabled ?? false}>{item.label}</MenuSubTrigger>
					<MenuSubPopup>
						{'choices' in item ? (
							<MenuRadioGroup value={item.value} onValueChange={item.onValueChange}>
								{item.choices.map(({ value, label, icon }) => (
									<MenuRadioItem key={value} value={value} label={label} closeOnClick>
										{icon === undefined ? (
											label
										) : (
											<span className="flex items-center gap-2">
												{icon}
												{label}
											</span>
										)}
									</MenuRadioItem>
								))}
							</MenuRadioGroup>
						) : (
							<>
								<AccessKeys items={item.items} close={close} />
								<MenuEntries items={item.items} close={close} />
							</>
						)}
					</MenuSubPopup>
				</MenuSub>
			);
		}

		if ('checked' in item) {
			return (
				<MenuCheckboxItem
					key={item.label}
					checked={item.checked}
					closeOnClick={item.closeOnClick ?? false}
					onCheckedChange={item.onCheckedChange}
				>
					{item.label}
				</MenuCheckboxItem>
			);
		}

		return (
			<MenuItem key={item.label} disabled={item.disabled ?? false} onClick={item.onSelect}>
				{item.label}
				{item.shortcut === undefined ? (
					item.accessKey !== undefined && <MenuShortcut>{item.accessKey.toUpperCase()}</MenuShortcut>
				) : (
					<MenuShortcut>{formatForDisplay(item.shortcut)}</MenuShortcut>
				)}
			</MenuItem>
		);
	});
}

function menuPoint(event: Event): MenuPoint | undefined {
	const pointer =
		typeof TouchEvent !== 'undefined' && event instanceof TouchEvent
			? event.touches[0]
			: event instanceof MouseEvent && (event.button === 2 || event.ctrlKey)
				? event
				: undefined;
	return pointer && { clientX: pointer.clientX, clientY: pointer.clientY };
}

/** A right-click menu for `render` */
export function AppContextMenu({ items, render, children, disabled = false, onOpenChange }: AppContextMenuProps) {
	const [origin, setOrigin] = useState<{ target: Element; point: MenuPoint | undefined }>();
	const [open, setOpen] = useState(false);
	const changeOpen = (newOpen: boolean) => {
		setOpen(newOpen);
		onOpenChange?.(newOpen);
	};
	const close = () => changeOpen(false);

	return (
		<ContextMenu
			disabled={disabled}
			open={open}
			onOpenChange={(next, { event }) => {
				if (typeof items === 'function') {
					setOrigin(
						next && event.target instanceof Element ? { target: event.target, point: menuPoint(event) } : undefined,
					);
				}
				changeOpen(next);
			}}
		>
			<ContextMenuTrigger render={render}>{children}</ContextMenuTrigger>
			<ContextMenuPopup align="start" side="bottom" sideOffset={0}>
				{open && (
					<MenuEntries
						items={typeof items === 'function' ? (origin ? items(origin.target, origin.point) : []) : items}
						close={close}
					/>
				)}
			</ContextMenuPopup>
		</ContextMenu>
	);
}

/** The same actions as a context menu, anchored to a visible MenuTrigger. */
export function AppActionMenu({
	items,
	label,
	shortcut,
	button,
	finalFocus,
	onOpenChange,
}: Pick<AppContextMenuProps, 'onOpenChange'> & {
	items: (trigger: Element) => readonly MenuEntry[];
	label: string;
	shortcut?: ComponentProps<typeof ControlTooltip>['shortcut'];
	button: ReactElement;
	finalFocus?: ComponentProps<typeof MenuPopup>['finalFocus'];
}) {
	const [trigger, setTrigger] = useState<Element>();
	const close = () => {
		setTrigger(undefined);
		onOpenChange?.(false);
	};
	return (
		<Menu
			open={trigger !== undefined}
			onOpenChange={(open, details) => {
				if (open && details.trigger) {
					setTrigger(details.trigger);
					onOpenChange?.(true);
				} else if (!open) {
					close();
				}
			}}
		>
			<ControlTooltip label={label} shortcut={shortcut} render={<MenuTrigger render={button} />}>
				<EllipsisIcon />
			</ControlTooltip>
			<MenuPopup align="end" finalFocus={finalFocus} onClick={(event) => event.stopPropagation()}>
				{trigger && <MenuEntries items={items(trigger)} close={close} />}
			</MenuPopup>
		</Menu>
	);
}
