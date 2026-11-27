import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
import type { Hotkey } from '@tanstack/react-hotkeys';
import { invoke } from '@tauri-apps/api/core';
import { check } from '@tauri-apps/plugin-updater';
import { createElement } from 'react';
import { toastManager, type ToastOptions } from '@/components/toast';
import { UpdateToastTitle } from '@/update-toast-title';

type Update = {
	/** The web app can't know the new version until it loads it */
	version: string | undefined;
	/** Installs the update and restarts Studio into it, throwing if installing fails. Calls `onDownloaded` once the update is downloaded and installing starts. */
	install: (onDownloaded?: () => void) => Promise<void> | void;
};

type UpdateState = { update: Update; installing: boolean };

const desktop = STUDIO_DESKTOP;

const updateStore = createAtom<UpdateState | undefined>(undefined);

/** How much of the desktop update has downloaded, from 0 to 100, or `undefined` when its size isn't known */
const downloadPercentStore = createAtom<number | undefined>(undefined);

/** Every update toast shares this ID, so checking or installing again replaces the one that's shown */
const updateToastId = 'update';

/** Checks for a newer version, then installs it when pressed again. Browsers reserve some ⌘ shortcuts, ex. Edge's Read Aloud, so the web app uses Alt. */
export const updateShortcut = (desktop ? 'Mod+Shift+U' : 'Alt+Shift+U') satisfies Hotkey;

function showUpdateToast({ title, ...options }: Omit<ToastOptions, 'title'> & { title: string | undefined }): void {
	toastManager.update(updateToastId, {
		...options,
		title: createElement(UpdateToastTitle, { title, percent: downloadPercentStore }),
	});
}

async function findDesktopUpdate(): Promise<Update | undefined> {
	const update = await check();
	if (!update) {
		return undefined;
	}
	return {
		version: update.version,
		install: async (onDownloaded) => {
			let size: number | undefined;
			let downloaded = 0;
			downloadPercentStore.set(undefined);
			await update.downloadAndInstall((event) => {
				switch (event.event) {
					case 'Started':
						size = event.data.contentLength;
						break;
					case 'Progress':
						downloaded += event.data.chunkLength;
						if (size !== undefined && size > 0) {
							// Whole percents, so the toast only redraws when the number it shows changes
							downloadPercentStore.set(Math.min(100, Math.floor((downloaded / size) * 100)));
						}
						break;
					case 'Finished':
						onDownloaded?.();
						break;
				}
			});
			// On Windows the installer already closed Studio and reopens it
			await invoke('relaunch');
		},
	};
}

/** Finds a newer version of the web app that the browser found for `registration`, which may still be downloading */
function findWebUpdate(registration: ServiceWorkerRegistration): Update | undefined {
	// A page the service worker doesn't control came from the network, so it's already the newest version
	if (!navigator.serviceWorker.controller || (!registration.installing && !registration.waiting)) {
		return undefined;
	}
	return {
		version: undefined,
		install: async (onDownloaded) => {
			downloadPercentStore.set(undefined);
			// A download that failed, ex. without internet, discards the new version, so this finds it again
			if (!registration.installing && !registration.waiting) {
				await registration.update();
			}
			const worker = registration.installing ?? registration.waiting;
			if (!worker) {
				throw new Error('The new version is no longer available');
			}
			// Waits for the new version to finish precaching, so it can load offline
			await Promise.all([waitForInstall(worker), showPrecacheProgress(registration, worker).catch(() => {})]);
			onDownloaded?.();
			// Every Studio tab reloads when the new version takes over, see `registerServiceWorker`
			// oxlint-disable-next-line unicorn/require-post-message-target-origin -- Service workers have no origin argument
			worker.postMessage({ type: 'SKIP_WAITING' });
		},
	};
}

function waitForInstall(worker: ServiceWorker): Promise<void> {
	return new Promise((resolve, reject) => {
		const settle = (): void => {
			if (worker.state === 'installing') {
				return;
			}
			worker.removeEventListener('statechange', settle);
			if (worker.state === 'redundant') {
				reject(new Error("Couldn't download the new version"));
			} else {
				resolve();
			}
		};
		worker.addEventListener('statechange', settle);
		settle();
	});
}

/**
 * Sets `downloadPercentStore` to how many of the new version's files `worker` has precached, until it finishes. Workbox
 * doesn't report its progress, so this reads the file list from the new service worker and checks Workbox's cache.
 */
async function showPrecacheProgress(registration: ServiceWorkerRegistration, worker: ServiceWorker): Promise<void> {
	const response = await fetch(worker.scriptURL, { cache: 'no-cache' });
	if (!response.ok) {
		return;
	}
	const script = await response.text();
	// Matches Workbox's cache keys, which add the revision to files without a hash in their name
	const files = new Set<string>();
	for (const [, url = '', revision] of script.matchAll(/\{url:"([^"]+)",revision:(?:null|"([^"]+)")\}/gu)) {
		const key = new URL(url, worker.scriptURL);
		if (revision !== undefined) {
			key.searchParams.set('__WB_REVISION__', revision);
		}
		files.add(key.href);
	}
	if (files.size === 0) {
		return;
	}
	// Each version shares this cache, so files that didn't change are already in it and don't count toward the download
	const cache = await caches.open(`workbox-precache-v2-${registration.scope}`);
	let alreadyCached: number | undefined;
	while (worker.state === 'installing') {
		// oxlint-disable-next-line no-await-in-loop -- Checks again a moment after the last check
		const [requests] = await Promise.all([
			cache.keys(),
			new Promise<void>((resolve) => {
				setTimeout(resolve, 200);
			}),
		]);
		const cached = requests.filter((request) => files.has(request.url)).length;
		alreadyCached ??= cached;
		const remaining = files.size - alreadyCached;
		downloadPercentStore.set(remaining > 0 ? Math.floor(((cached - alreadyCached) / remaining) * 100) : 100);
	}
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

	let registration: ServiceWorkerRegistration | undefined;
	try {
		registration = await navigator.serviceWorker.register('/sw.js');
	} catch {
		// Usually means there's no internet, ex. at an event, so there's nothing worth telling the user
		return;
	}
	// Some web archivers and extensions stub `register()` to resolve to `undefined`
	if (registration === undefined) {
		return;
	}
	const showUpdate = (): void => {
		const update = findWebUpdate(registration);
		if (update && updateStore.get()?.installing !== true) {
			updateStore.set({ update, installing: false });
		}
	};
	// The browser checks for a new version after loading the page, usually after registering finishes, then downloads it
	registration.addEventListener('updatefound', showUpdate);
	// Or it found one before, ex. in a tab that's still open
	showUpdate();
}

/** Check for a newer version when the user asks, telling them what was found */
export async function checkForUpdateManually(): Promise<void> {
	if (updateStore.get()?.installing === true) {
		return;
	}

	showUpdateToast({ type: 'loading', title: 'Checking for updates…' });
	let update: Update | undefined;
	try {
		update = await findUpdate();
	} catch (error) {
		showUpdateToast({
			type: 'error',
			title: "Couldn't check for updates",
			description: String(error),
		});
		return;
	}

	if (update) {
		updateStore.set({ update, installing: false });
		showUpdateToast({
			type: 'info',
			title: 'An update is available',
			actionProps: {
				children: 'Download',
				onClick: () => void checkOrInstallUpdate(),
				shortcut: updateShortcut,
			},
			timeout: 0,
		});
	} else {
		showUpdateToast({
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

	showUpdateToast({ type: 'loading', title: undefined });
	// Failing replaces this toast with an error
	await installUpdate(state.update, showPreparingUpdate);
}

function showPreparingUpdate(): void {
	showUpdateToast({ type: 'loading', title: 'Preparing update…' });
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

/** Calls `listener` with the update now and whenever it changes */
export function watchUpdate(listener: (state: UpdateState | undefined) => void): void {
	listener(updateStore.get());
	updateStore.subscribe(listener);
}

export function updateTitle(update: Update): string {
	return update.version === undefined ? 'Update Studio' : `Update to ${update.version}`;
}

/** Install `update`, then restart into it */
export async function installUpdate(update: Update, onDownloaded?: () => void): Promise<void> {
	updateStore.set({ update, installing: true });
	try {
		await update.install(onDownloaded);
	} catch (error) {
		updateStore.set({ update, installing: false });
		showUpdateToast({ type: 'error', title: "Couldn't update Studio", description: String(error) });
	}
}
