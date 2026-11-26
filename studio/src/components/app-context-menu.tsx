import { ContextMenu } from '@astryxdesign/core/ContextMenu';
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuDivider,
	DropdownMenuItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSubMenu,
} from '@astryxdesign/core/DropdownMenu';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Tooltip } from '@astryxdesign/core/Tooltip';
import type { StyleXStyles } from '@stylexjs/stylex';
import type { Hotkey, HotkeyChord } from '@tanstack/react-hotkeys';
import EllipsisIcon from 'lucide-react/icons/ellipsis';
import { type ReactNode, type RefObject, useRef, useState } from 'react';
import { useEventListener } from 'usehooks-ts';
import { Shortcut } from '@/components/shortcut';
import { TooltipLabel } from '@/components/tooltip-label';

export type MenuAction = {
	label: string;
	shortcut?: HotkeyChord;
	/** A single key that selects the item while its submenu is open, ex. `S` */
	accessKey?: string;
	disabled?: boolean;
	description?: string;
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

/**
 * Selects a submenu's items by their access keys, while it's mounted. Selecting clicks the item, so the menu closes
 * like it does for any other pick.
 */
function AccessKeys({ items, elements }: { items: readonly MenuEntry[]; elements: Map<string, HTMLElement> }) {
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
			const element = item && elements.get(item.label);
			if (element) {
				event.preventDefault();
				event.stopPropagation();
				element.click();
			}
		},
		undefined,
		true,
	);

	return null;
}

function SubmenuEntries({ items }: { items: readonly MenuEntry[] }) {
	const [elements] = useState(() => new Map<string, HTMLElement>());
	return (
		<>
			<AccessKeys items={items} elements={elements} />
			<MenuEntries items={items} elements={elements} />
		</>
	);
}

export function MenuEntries({ items, elements }: { items: readonly MenuEntry[]; elements?: Map<string, HTMLElement> }) {
	return items.map((item, index, all) => {
		if (item === 'separator') {
			const previous = all[index - 1];
			return <DropdownMenuDivider key={`after ${typeof previous === 'object' ? previous.label : ''}`} />;
		}

		if ('items' in item || 'choices' in item) {
			return (
				<DropdownMenuSubMenu key={item.label} label={item.label} isDisabled={item.disabled ?? false}>
					{'choices' in item ? (
						<DropdownMenuRadioGroup label={item.label} value={item.value ?? undefined} onChange={item.onValueChange}>
							{item.choices.map(({ value, label, icon }) => (
								<DropdownMenuRadioItem key={value} value={value} label={label} icon={icon} />
							))}
						</DropdownMenuRadioGroup>
					) : (
						<SubmenuEntries items={item.items} />
					)}
				</DropdownMenuSubMenu>
			);
		}

		if ('checked' in item) {
			return (
				<DropdownMenuCheckboxItem
					key={item.label}
					label={item.label}
					value={item.checked}
					hasCloseOnSelect={item.closeOnClick ?? false}
					onChange={item.onCheckedChange}
				/>
			);
		}

		const shortcut = item.shortcut ?? (item.accessKey === undefined ? undefined : { key: item.accessKey });
		return (
			<DropdownMenuItem
				key={item.label}
				ref={
					elements &&
					((element: HTMLElement | null) => {
						if (element) {
							elements.set(item.label, element);
						} else {
							elements.delete(item.label);
						}
					})
				}
				label={item.label}
				description={item.description}
				isDisabled={item.disabled ?? false}
				endContent={shortcut === undefined ? undefined : <Shortcut hotkey={shortcut} />}
				onClick={item.onSelect}
			/>
		);
	});
}

/** Where the menu was opened with a pointer, `undefined` when it was opened from the keyboard */
function menuPoint(event: React.MouseEvent | React.TouchEvent): MenuPoint | undefined {
	if ('touches' in event) {
		return event.touches[0];
	}
	return event.button === 2 || event.ctrlKey ? { clientX: event.clientX, clientY: event.clientY } : undefined;
}

/**
 * A right-click (or long-press) menu for `children`, which are wrapped in an element that has `data-menu-open` while
 * it's open. `triggerXstyle` lays out that element, ex. filling the parent.
 */
export function AppContextMenu({
	items,
	children,
	label = 'Context menu',
	disabled = false,
	inline = false,
	triggerXstyle,
	onOpenChange,
}: {
	/** Or a function of the right-clicked element, for menus that depend on what's under the pointer */
	items: readonly MenuEntry[] | ((target: Element, point?: MenuPoint) => readonly MenuEntry[]);
	children: ReactNode;
	label?: string;
	/** Shows the browser's own context menu instead */
	disabled?: boolean;
	/** Wraps `children` in a `span`, for inline content */
	inline?: boolean;
	triggerXstyle?: StyleXStyles | StyleXStyles[];
	onOpenChange?: (open: boolean) => void;
}) {
	const [origin, setOrigin] = useState<{ target: Element; point: MenuPoint | undefined }>();
	const [open, setOpen] = useState(false);
	const remember = (event: React.MouseEvent | React.TouchEvent) => {
		if (typeof items === 'function' && event.target instanceof Element) {
			setOrigin({ target: event.target, point: menuPoint(event) });
		}
	};

	let entries: readonly MenuEntry[] = [];
	if (typeof items !== 'function') {
		entries = items;
	} else if (origin) {
		entries = items(origin.target, origin.point);
	}

	return (
		<ContextMenu
			label={label}
			isDisabled={disabled}
			triggerAs={inline ? 'span' : 'div'}
			triggerXstyle={triggerXstyle}
			data-menu-open={open ? '' : undefined}
			onContextMenu={remember}
			onTouchStart={remember}
			onOpenChange={(next) => {
				setOpen(next);
				onOpenChange?.(next);
			}}
			menuContent={open && <MenuEntries items={entries} />}
		>
			{children}
		</ContextMenu>
	);
}

/**
 * The same actions as a context menu, from an ellipsis button. `triggerXstyle` styles the button, which has
 * `aria-expanded` while the menu is open.
 */
export function AppActionMenu({
	items,
	label,
	accessibleLabel = label,
	shortcut,
	triggerXstyle,
	isFocusable = true,
	finalFocus,
	onOpenChange,
}: {
	items: (trigger: Element) => readonly MenuEntry[];
	/** Shown in the button's tooltip */
	label: string;
	/** The button's name, when it needs to say more than its tooltip, ex. which row it's for */
	accessibleLabel?: string;
	shortcut?: Hotkey;
	triggerXstyle?: StyleXStyles;
	/** Leaves the button out of the tab order, ex. when its row opens the menu from the keyboard instead */
	isFocusable?: boolean;
	/** Where focus goes when the menu closes instead of the button, ex. its row */
	finalFocus?: RefObject<HTMLElement | null>;
	onOpenChange?: (open: boolean) => void;
}) {
	const trigger = useRef<HTMLElement>(null);
	/** The button, while the menu is open */
	const [openFrom, setOpenFrom] = useState<HTMLElement>();
	return (
		<DropdownMenu
			alignment="end"
			onOpenChange={(next) => {
				setOpenFrom(next ? (trigger.current ?? undefined) : undefined);
				onOpenChange?.(next);
				if (!next && finalFocus) {
					// After the menu returns focus to the button
					requestAnimationFrame(() => {
						if (document.activeElement === trigger.current) {
							finalFocus.current?.focus();
						}
					});
				}
			}}
			renderTrigger={(props) => (
				<Tooltip content={<TooltipLabel label={label} shortcut={shortcut} />} isEnabled={openFrom === undefined}>
					<IconButton
						{...props}
						ref={(element: HTMLElement | null) => {
							props.ref(element);
							trigger.current = element;
						}}
						label={accessibleLabel}
						icon={<EllipsisIcon />}
						variant="ghost"
						size="sm"
						xstyle={triggerXstyle}
						tabIndex={isFocusable ? undefined : -1}
						// Inside rows that do something else when pressed, ex. entries that are dragged and added on double-click
						onPointerDown={(event) => {
							props.onPointerDown(event);
							event.stopPropagation();
						}}
						onClick={(event) => {
							props.onClick(event);
							event.stopPropagation();
						}}
						onDoubleClick={(event) => event.stopPropagation()}
					/>
				</Tooltip>
			)}
		>
			{openFrom && <MenuEntries items={items(openFrom)} />}
		</DropdownMenu>
	);
}
