import { AppActionMenu, type MenuAction } from '@/components/app-context-menu';
import { SidebarMenuAction } from '@/sidebar/sidebar-ui';

type DashboardOptionsProps = {
	items: readonly (MenuAction | 'separator')[];
	hidden: boolean;
};

/** The dashboard's context menu, opened from its `…` button */
export function DashboardOptions({ items, hidden }: DashboardOptionsProps) {
	return (
		<SidebarMenuAction hidden={hidden}>
			<AppActionMenu items={() => items} label="Dashboard options" />
		</SidebarMenuAction>
	);
}
