import { useHotkey } from '@tanstack/react-hotkeys';
import { useParams, useRouter } from '@tanstack/react-router';
import { type MouseEvent, useState } from 'react';
import type { MenuAction } from '@/components/app-context-menu';
import { type Dashboard, deleteDashboards, duplicateDashboards } from '@/dashboards/dashboards';
import { splitDashboards } from '@/dashboards/panes';
import { canJoinLayouts } from '@/panes/layout';

/**
 * ⌘ or Ctrl-clicking dashboards selects them along with the open one, and Shift-clicking selects every dashboard
 * from the last one clicked. Their menus then act on every selected dashboard.
 */
export function useDashboardSelection(dashboards: Dashboard[]) {
	const router = useRouter();
	const { dashboardId: openId } = useParams({ strict: false });
	const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
	const [anchorId, setAnchorId] = useState<string>();
	// In sidebar order, without closed dashboards
	const selected = dashboards.filter((dashboard) => selectedIds.has(dashboard.id));
	const ids = selected.map((dashboard) => dashboard.id);
	const clear = () => {
		setSelectedIds(new Set());
		setAnchorId(undefined);
	};
	useHotkey('Escape', clear, { enabled: selected.length > 0 });

	const open = async (id: string | undefined) => {
		clear();
		if (id !== undefined) {
			await router.navigate({ to: '/dashboards/$dashboardId', params: { dashboardId: id } });
		}
	};

	/** Handles a click on a dashboard, returns whether it changed the selection instead of opening the dashboard */
	const click = (event: MouseEvent, dashboard: Dashboard): boolean => {
		if (event.shiftKey) {
			const all = dashboards.map((other) => other.id);
			const from = all.indexOf(anchorId ?? openId ?? dashboard.id);
			const to = all.indexOf(dashboard.id);
			setSelectedIds(new Set(from === -1 ? [dashboard.id] : all.slice(Math.min(from, to), Math.max(from, to) + 1)));
			return true;
		}

		if (event.metaKey || event.ctrlKey) {
			const toggled = new Set(selected.length > 0 || openId === undefined ? ids : [openId]);
			if (!toggled.delete(dashboard.id)) {
				toggled.add(dashboard.id);
			}
			setSelectedIds(toggled);
			setAnchorId(dashboard.id);
			return true;
		}

		clear();
		return false;
	};

	const menuItems: (MenuAction | 'separator')[] = [
		{
			label: 'Open as split',
			// Panes would be narrower than a quarter of the dashboard
			disabled: !canJoinLayouts(selected.map((dashboard) => dashboard.layout)),
			// Opened first, otherwise closing the open dashboard selects the one below it instead
			onSelect: () => void open(ids[0]).then(() => splitDashboards(ids)),
		},
		{ label: 'Duplicate dashboards', onSelect: () => void open(duplicateDashboards(ids)[0]) },
		'separator',
		{
			label: `Close ${ids.length} dashboards`,
			destructive: true,
			onSelect: () => {
				deleteDashboards(ids);
				clear();
			},
		},
	];

	return {
		/** Whether a dashboard is selected along with others, so its menus act on the selection */
		isSelected: (dashboard: Dashboard) => selected.length > 1 && selectedIds.has(dashboard.id),
		click,
		clear,
		/** The menu of a selected dashboard */
		menuItems,
		/** Copy dashboards and open the first copy */
		duplicate: (duplicated: readonly string[]) => void open(duplicateDashboards(duplicated)[0]),
	};
}

export type DashboardSelection = ReturnType<typeof useDashboardSelection>;
