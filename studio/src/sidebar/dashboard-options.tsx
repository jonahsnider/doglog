import { useFormatForDisplay } from '@tanstack/react-hotkeys';
import EllipsisIcon from 'lucide-react/icons/ellipsis';
import { useState } from 'react';
import type { MenuAction } from '@/components/app-context-menu';
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuShortcut, MenuTrigger } from '@/components/ui/menu';
import { SidebarMenuAction } from '@/components/ui/sidebar';

type DashboardOptionsProps = {
	items: readonly (MenuAction | 'separator')[];
	hidden: boolean;
};

/** The dashboard's context menu, opened from its `…` button */
export function DashboardOptions({ items, hidden }: DashboardOptionsProps) {
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
