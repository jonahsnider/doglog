import { detectPlatform } from '@tanstack/react-hotkeys';
import type { RegisteredRouter } from '@tanstack/react-router';
import type { MenuAction } from '@/components/app-context-menu';
import { shortcuts } from '@/commands/commands';
import { canCopyDashboardLink, copyDashboardLink } from '@/dashboards/copy-dashboard-link';
import type { Dashboard } from '@/dashboards/dashboards';
import { useSource } from '@/data/source';
import { canCapture, copyDashboardImage } from '@/desktop/capture';
import { canExportClip, startRecording } from '@/desktop/clip';

/** A dashboard's sidebar menu actions that share it, as a link, an image, or a clip */
export function useDashboardCopyItems(dashboard: Dashboard, router: RegisteredRouter): MenuAction[] {
	// Export clip needs a log
	const source = useSource();
	if (!canCopyDashboardLink(dashboard)) {
		return [];
	}
	const open = router.state.location.pathname === `/dashboards/${dashboard.id}`;
	const items: MenuAction[] = [
		{ label: 'Copy link', shortcut: shortcuts.copyDashboardLink, onSelect: () => void copyDashboardLink(dashboard) },
	];
	if (STUDIO_DESKTOP && canCapture) {
		const onSelect = () => void copyDashboardImage(router, dashboard.id);
		const showShortcut = detectPlatform() === 'mac' || open;
		items.push({ label: 'Copy image', onSelect, ...(showShortcut && { shortcut: shortcuts.copyDashboardImage }) });
	}
	// Only for the open dashboard, which Record mode previews
	if (open && canExportClip(dashboard, source)) {
		items.push({
			label: 'Export clip',
			shortcut: shortcuts.exportClip,
			onSelect: () => startRecording(router, dashboard.id),
		});
	}
	return items;
}
