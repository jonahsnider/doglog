import { invoke } from '@tauri-apps/api/core';
import { toastManager } from '@/components/toast';
import { DashboardLinkTooLarge, encodeDashboardLink } from '@/dashboards/dashboard-link';
import type { DashboardContents } from '@/dashboards/doc';
import { panes } from '@/panes/layout';

export function canCopyDashboardLink({ layout }: DashboardContents): boolean {
	return panes(layout).some((pane) => pane.widget !== undefined);
}

export async function copyDashboardLink(dashboard: DashboardContents): Promise<void> {
	try {
		const origin = import.meta.env.DEV && !STUDIO_DESKTOP ? window.location.origin : 'https://doglog.studio';
		if (STUDIO_DESKTOP) {
			const link = await encodeDashboardLink(dashboard);
			await invoke('plugin:clipboard-manager|write_text', { text: `${origin}/import/${link}` });
		} else {
			if (!('clipboard' in navigator) || typeof ClipboardItem === 'undefined') {
				throw new Error('Clipboard unavailable');
			}
			// Start the clipboard write during the user gesture, before async compression loses activation in WebKit.
			const text = encodeDashboardLink(dashboard).then(
				(link) => new Blob([`${origin}/import/${link}`], { type: 'text/plain' }),
			);
			await Promise.all([text, navigator.clipboard.write([new ClipboardItem({ 'text/plain': text })])]);
		}
		toastManager.add({ type: 'success', title: 'Copied dashboard URL' });
	} catch (error) {
		toastManager.add({
			type: 'error',
			title: 'Couldn’t copy dashboard link',
			description:
				error instanceof DashboardLinkTooLarge
					? 'This dashboard is too large to share as a link.'
					: 'The link couldn’t be created or copied.',
		});
	}
}
