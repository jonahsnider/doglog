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
export function openDashboardLinkInDesktop(link: string): void {
	const url = `doglog://import/${link}`;
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

/** Import dashboard links the OS asks the desktop app to open, ex. when the browser hands one to it */
export async function handleOpenedDashboardLinks(router: RegisteredRouter): Promise<void> {
	const openTakenLink = async () => {
		const link = await invoke<string | null>('take_opened_dashboard_link');
		if (link !== null) {
			await router.navigate({ to: '/import/$link', params: { link } });
		}
	};
	await listen('dashboard-link-opened', () => void openTakenLink());
	// Links opened before the listener was added, ex. the one that launched the app
	await openTakenLink();
}
