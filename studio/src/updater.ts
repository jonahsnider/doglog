import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
import { formatForDisplay, type Hotkey } from '@tanstack/react-hotkeys';
import { invoke } from '@tauri-apps/api/core';
import { check } from '@tauri-apps/plugin-updater';
import { toastManager } from '@/components/ui/toast';

type Update = {
	/** The web app can't know the new version until it loads it */
	version: string | undefined;
	/** Installs the update and restarts Studio into it, throwing if installing fails */
	install: () => Promise<void> | void;
};

type UpdateState = { update: Update; installing: boolean };

const desktop = STUDIO_DESKTOP;

const updateStore = createAtom<UpdateState | undefined>(undefined);

/** Checks for a newer version, then installs it when pressed again. Browsers reserve some ⌘ shortcuts, ex. Edge's Read Aloud, so the web app uses Alt. */
export const updateShortcut = (desktop ? 'Mod+Shift+U' : 'Alt+Shift+U') satisfies Hotkey;

async function findDesktopUpdate(): Promise<Update | undefined> {
	const update = await check();
	if (!update) {
		return undefined;
	}
	return {
		version: update.version,
		install: async () => {
			await update.downloadAndInstall();
			// On Windows the installer already closed Studio and reopens it
			await invoke('relaunch');
		},
	};
}

/** Finds a newer version of the web app in the service worker that `registration` downloaded */
async function findWebUpdate(registration: ServiceWorkerRegistration): Promise<Update | undefined> {
	// A page the service worker doesn't control came from the network, so it's already the newest version
	if (!navigator.serviceWorker.controller) {
		return undefined;
	}

	const worker = registration.installing;
	if (worker) {
		// Waits for the new version to finish precaching, so it can load offline
		await new Promise((resolve) => {
			worker.addEventListener('statechange', () => {
				if (worker.state !== 'installing') {
					resolve(undefined);
				}
			});
		});
	}
	const waiting = registration.waiting;
	if (!waiting) {
		return undefined;
	}
	return {
		version: undefined,
		install: () => {
			// Every Studio tab reloads when the new version takes over, see `registerServiceWorker`
			// oxlint-disable-next-line unicorn/require-post-message-target-origin -- Service workers have no origin argument
			waiting.postMessage({ type: 'SKIP_WAITING' });
		},
	};
}

async function findUpdate(): Promise<Update | undefined> {
	if (desktop) {
		return findDesktopUpdate();
	}
	// HTTP pages other than localhost, ex. Studio served on a LAN IP, have no `navigator.serviceWorker`
	const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
	if (!registration) {
		return undefined;
	}
	await registration.update();
	return findWebUpdate(registration);
}

/** Registers the web app's service worker, which also checks for a newer version */
export async function registerServiceWorker(): Promise<void> {
	// Open tabs would fail to load chunks the new version removed, so they all reload into it. The first service
	// worker never takes over open tabs, so this only happens when updating.
	navigator.serviceWorker.addEventListener('controllerchange', () => location.reload());

	let registration: ServiceWorkerRegistration;
	try {
		registration = await navigator.serviceWorker.register('/sw.js');
	} catch {
		// Usually means there's no internet, ex. at an event, so there's nothing worth telling the user
		return;
	}
	const showUpdate = async (): Promise<void> => {
		const update = await findWebUpdate(registration);
		if (update && updateStore.get()?.installing !== true) {
			updateStore.set({ update, installing: false });
		}
	};
	// The browser checks for a new version after loading the page, usually after registering finishes
	registration.addEventListener('updatefound', () => void showUpdate());
	// Or it found one before, ex. in a tab that's still open
	await showUpdate();
}

/** Check for a newer version when the user asks, telling them what was found */
export async function checkForUpdateManually(): Promise<void> {
	if (updateStore.get()?.installing === true) {
		return;
	}

	const toastId = toastManager.add({ type: 'loading', title: 'Checking for updates…' });
	let update: Update | undefined;
	try {
		update = await findUpdate();
	} catch (error) {
		toastManager.update(toastId, { type: 'error', title: "Couldn't check for updates", description: String(error) });
		return;
	}

	if (update) {
		updateStore.set({ update, installing: false });
		// oxlint-disable-next-line typescript/no-deprecated -- Outside a component it's the way to format a shortcut
		const shortcut = formatForDisplay(updateShortcut);
		toastManager.update(toastId, {
			type: 'info',
			title: `An update is available`,
			description: `Press ${shortcut} to ${desktop ? 'restart' : 'reload'} and update.`,
			timeout: 0,
		});
	} else {
		toastManager.update(toastId, {
			type: 'info',
			title: 'DogLog Studio is up to date',
		});
	}
}

/** Check for a newer version, or install the one that was found */
export async function checkOrInstallUpdate(): Promise<void> {
	const state = updateStore.get();
	if (!state) {
		await checkForUpdateManually();
		return;
	}
	if (state.installing) {
		return;
	}

	const title = state.update.version === undefined ? 'Updating Studio…' : `Updating to ${state.update.version}…`;
	const toastId = toastManager.add({ type: 'loading', title });
	if (!(await installUpdate(state.update))) {
		// Installing failed, which shows its own toast
		toastManager.close(toastId);
	}
}

// Development builds would always find a "newer" release. The web app checks when it registers its service worker.
if (desktop && !import.meta.env.DEV) {
	void (async () => {
		try {
			const update = await findDesktopUpdate();
			if (update) {
				updateStore.set({ update, installing: false });
			}
		} catch {
			// Usually means there's no internet, ex. at an event, so there's nothing worth telling the user
		}
	})();
}

export function useUpdate(): UpdateState | undefined {
	return useSelector(updateStore);
}

export function updateTitle(update: Update): string {
	return update.version === undefined ? 'Update Studio' : `Update to ${update.version}`;
}

/** Install `update`, then restart into it. Returns whether installing succeeded. */
export async function installUpdate(update: Update): Promise<boolean> {
	updateStore.set({ update, installing: true });
	try {
		await update.install();
		return true;
	} catch (error) {
		updateStore.set({ update, installing: false });
		toastManager.add({ type: 'error', title: "Couldn't update Studio", description: String(error) });
		return false;
	}
}
