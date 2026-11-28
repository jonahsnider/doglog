import type { RegisteredRouter } from '@tanstack/react-router';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { toastManager } from '@/components/toast';

declare global {
	interface Navigator {
		/** Only in Chromium browsers */
		readonly userAgentData?: { readonly mobile: boolean };
	}
}

/**
 * Offer to open a dashboard link in the desktop app. Desktop Chromium browsers ask right away, since they do nothing when
 * the app isn't installed. Other browsers show an error then, so they only ask when the user picks it from a toast.
 */
export function openDashboardLinkInDesktop(dashboardId: string): void {
	const url = `doglog://shared/${dashboardId}`;
	if (navigator.userAgentData) {
		if (!navigator.userAgentData.mobile) {
			location.assign(url);
		}
		return;
	}
	// iPadOS Safari reports itself as a Mac, but Macs have no touchscreen
	const mobile =
		/Android|iPhone|iPad/u.test(navigator.userAgent) ||
		(navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 0);
	if (mobile) {
		return;
	}
	toastManager.add({
		title: 'Open in the desktop app?',
		actionProps: { children: 'Open', onClick: () => location.assign(url) },
	});
}

/** Open dashboard links the OS hands the desktop app. */
export async function handleOpenedDashboardLinks(router: RegisteredRouter): Promise<void> {
	const openTakenLink = async () => {
		const dashboardId = await invoke<string | null>('take_opened_dashboard_link');
		if (dashboardId !== null) {
			await router.navigate({ to: '/shared/$dashboardId', params: { dashboardId } });
		}
	};
	await listen('dashboard-link-opened', () => void openTakenLink());
	// Links opened before the listener was added, ex. the one that launched the app
	await openTakenLink();
}
