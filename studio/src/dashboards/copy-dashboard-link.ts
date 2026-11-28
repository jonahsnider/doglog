import { invoke } from '@tauri-apps/api/core';
import { currentCloudScope } from '@/cloud/session';
import { toastManager } from '@/components/toast';
import { type Dashboard, getSharing } from '@/dashboards/dashboards';

export function canCopyDashboardLink({ id, shared }: Dashboard): boolean {
	if (!shared) {
		return false;
	}
	const { scope, deletedAt } = getSharing(id);
	return scope !== undefined && scope === currentCloudScope() && deletedAt === undefined;
}

export async function copyDashboardLink(dashboard: Dashboard): Promise<void> {
	if (!canCopyDashboardLink(dashboard)) {
		return;
	}
	const origin = import.meta.env.DEV && !STUDIO_DESKTOP ? window.location.origin : 'https://doglog.studio';
	const text = `${origin}/shared/${dashboard.id}`;
	try {
		if (STUDIO_DESKTOP) {
			await invoke('plugin:clipboard-manager|write_text', { text });
		} else {
			await navigator.clipboard.writeText(text);
		}
		toastManager.add({ type: 'success', title: 'Copied dashboard URL' });
	} catch {
		toastManager.add({ type: 'error', title: 'Couldn’t copy dashboard link' });
	}
}
