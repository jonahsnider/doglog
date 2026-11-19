import { useFormatForDisplay } from '@tanstack/react-hotkeys';
import { isTauri } from '@tauri-apps/api/core';
import { LogicalPosition } from '@tauri-apps/api/dpi';
import { EllipsisIcon } from 'lucide-react';
import { useState } from 'react';
import type { MenuAction } from '@/components/app-context-menu';
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuShortcut, MenuTrigger } from '@/components/ui/menu';
import { SidebarMenuAction } from '@/components/ui/sidebar';
import { popUpNativeMenu } from '@/desktop/native-menu';

type DashboardOptionsProps = {
	items: readonly (MenuAction | 'separator')[];
	hidden: boolean;
};

function NativeDashboardOptions({ items, hidden }: DashboardOptionsProps) {
	return (
		<SidebarMenuAction
			showOnHover
			className={hidden ? 'invisible' : undefined}
			onClick={(event) => {
				const rect = event.currentTarget.getBoundingClientRect();
				void popUpNativeMenu(items, new LogicalPosition(rect.right, rect.top));
			}}
		>
			<EllipsisIcon />
			<span className="sr-only">Dashboard options</span>
		</SidebarMenuAction>
	);
}

function WebDashboardOptions({ items, hidden }: DashboardOptionsProps) {
	const [open, setOpen] = useState(false);
	const formatForDisplay = useFormatForDisplay();

	return (
		<Menu open={open} onOpenChange={setOpen}>
			<MenuTrigger
				render={<SidebarMenuAction showOnHover className={hidden ? 'invisible' : undefined} />}
				// The open menu doesn't cover its own button, so right-clicking it would open the context menu on top
				onContextMenu={() => setOpen(false)}
			>
				<EllipsisIcon />
				<span className="sr-only">Dashboard options</span>
			</MenuTrigger>
			<MenuPopup align="start" side="right">
				{items.map((item, index, all) => {
					if (item === 'separator') {
						const previous = all[index - 1];
						return <MenuSeparator key={`after ${typeof previous === 'object' ? previous.label : ''}`} />;
					}

					return (
						<MenuItem
							key={item.label}
							disabled={item.disabled ?? false}
							variant={item.destructive === true ? 'destructive' : 'default'}
							onClick={item.onSelect}
						>
							{item.label}
							{item.shortcut !== undefined && <MenuShortcut>{formatForDisplay(item.shortcut)}</MenuShortcut>}
						</MenuItem>
					);
				})}
			</MenuPopup>
		</Menu>
	);
}

/** The dashboard's context menu, as a native menu in the desktop app */
export const DashboardOptions = isTauri() ? NativeDashboardOptions : WebDashboardOptions;
