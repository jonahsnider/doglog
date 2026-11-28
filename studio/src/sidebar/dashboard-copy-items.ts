import type { RegisteredRouter } from '@tanstack/react-router';
import { useSyncExternalStore } from 'react';
import type { MenuAction } from '@/components/app-context-menu';
import { shortcuts } from '@/commands/commands';
import { canCopyDashboardLink, copyDashboardLink } from '@/dashboards/copy-dashboard-link';
import type { Dashboard } from '@/dashboards/dashboards';
import { subscribeData } from '@/data/data-store';
import { useSource } from '@/data/source';
import { canCaptureDashboard, copyDashboardImage } from '@/desktop/capture';
import { canExportVideo, startVideoExport } from '@/desktop/video-export';

/** The copy and export section of a dashboard's sidebar menu, with a leading separator when present */
export function useDashboardCopyItems(
	dashboard: Dashboard,
	router: RegisteredRouter,
	active: boolean,
): (MenuAction | 'separator')[] {
	const source = useSource();
	const canExport = useSyncExternalStore(subscribeData, () => active && canExportVideo(dashboard, source));
	const items: MenuAction[] = [];
	if (canCopyDashboardLink(dashboard)) {
		items.push({
			label: 'Copy link',
			shortcut: shortcuts.copyDashboardLink,
			onSelect: () => void copyDashboardLink(dashboard),
		});
	}
	if (canCaptureDashboard(dashboard)) {
		items.push({
			label: 'Copy image',
			onSelect: () => void copyDashboardImage(router, dashboard.id),
			...(active && { shortcut: shortcuts.copyDashboardImage }),
		});
	}
	if (canExport) {
		items.push({
			label: 'Export video…',
			shortcut: shortcuts.exportVideo,
			onSelect: () => startVideoExport(router, dashboard.id),
		});
	}
	return items.length === 0 ? [] : ['separator', ...items];
}
