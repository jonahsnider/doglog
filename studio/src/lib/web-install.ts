import { createAtom } from '@tanstack/store';
import { useMediaQuery } from '@/hooks/use-media-query';
import { isMobileDevice } from '@/lib/mobile-layout';

interface InstallPromptEvent extends Event {
	prompt(): Promise<unknown>;
}

declare global {
	interface WindowEventMap {
		beforeinstallprompt: InstallPromptEvent;
	}
}

export const webInstallPrompt = createAtom<InstallPromptEvent | undefined>(undefined);

export function useInstalledWebApp(): boolean {
	const standalone = useMediaQuery('(display-mode: standalone)');
	return standalone || ('standalone' in navigator && navigator.standalone === true);
}

/** Capture the event at startup, even if the sidebar has not been opened yet. */
export function trackWebInstallPrompt(): void {
	if (!isMobileDevice()) {
		return;
	}
	window.addEventListener('beforeinstallprompt', (event) => {
		event.preventDefault();
		webInstallPrompt.set(event);
	});
	window.addEventListener('appinstalled', () => webInstallPrompt.set(undefined));
}

export async function promptWebInstall(): Promise<void> {
	const event = webInstallPrompt.get();
	if (event === undefined) {
		return;
	}
	// Each event can only prompt once, even if the user dismisses it.
	webInstallPrompt.set(undefined);
	await event.prompt();
}
