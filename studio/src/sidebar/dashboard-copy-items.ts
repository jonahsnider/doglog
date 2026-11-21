import { detectPlatform } from '@tanstack/react-hotkeys';
import type { RegisteredRouter } from '@tanstack/react-router';
import { useSyncExternalStore } from 'react';
import type { MenuAction } from '@/components/app-context-menu';
import { shortcuts } from '@/commands/commands';
import { canCopyDashboardLink, copyDashboardLink } from '@/dashboards/copy-dashboard-link';
import type { Dashboard } from '@/dashboards/dashboards';
import { subscribeData } from '@/data/data-store';
import { useSource } from '@/data/source';
import { canCapture, copyDashboardImage } from '@/desktop/capture';
import { canExportVideo, startVideoExport } from '@/desktop/video-export';

/** A dashboard's sidebar menu actions that share it, as a link, an image, or a video */
export function useDashboardCopyItems(dashboard: Dashboard, router: RegisteredRouter): MenuAction[] {
	const source = useSource();
	const open = router.state.location.pathname === `/dashboards/${dashboard.id}`;
	const canExport = useSyncExternalStore(subscribeData, () => open && canExportVideo(dashboard, source));
	if (!canCopyDashboardLink(dashboard)) {
		return [];
	}
	const items: MenuAction[] = [
		{ label: 'Copy link', shortcut: shortcuts.copyDashboardLink, onSelect: () => void copyDashboardLink(dashboard) },
	];
	if (STUDIO_DESKTOP && canCapture) {
		const onSelect = () => void copyDashboardImage(router, dashboard.id);
		const showShortcut = detectPlatform() === 'mac' || open;
		items.push({ label: 'Copy image', onSelect, ...(showShortcut && { shortcut: shortcuts.copyDashboardImage }) });
	}
	if (canExport) {
		items.push({
			label: 'Export video…',
			shortcut: shortcuts.exportVideo,
			onSelect: () => startVideoExport(router, dashboard.id),
		});
	}
	return items;
}
