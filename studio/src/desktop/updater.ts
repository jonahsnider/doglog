import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
import { formatForDisplay, type Hotkey } from '@tanstack/react-hotkeys';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { toastManager } from '@/components/ui/toast';

/** A newer desktop release, and whether it's being installed */
type UpdateState = { update: Update; installing: boolean };

const updateStore = createAtom<UpdateState | undefined>(undefined);

/** Checks for a newer release, then installs it when pressed again */
export const updateShortcut = 'Mod+Shift+U' satisfies Hotkey;

async function checkForUpdate(): Promise<void> {
	try {
		const update = await check();
		if (update) {
			updateStore.set({ update, installing: false });
		}
	} catch {
		// Usually means there's no internet, ex. at an event, so there's nothing worth telling the user
	}
}

/** Check for a newer release when the user asks, telling them what was found */
export async function checkForUpdateManually(): Promise<void> {
	if (updateStore.get()?.installing === true) {
		return;
	}

	const toastId = toastManager.add({ type: 'loading', title: 'Checking for updates…' });
	let update: Update | null;
	try {
		update = await check();
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
			description: `Press ${shortcut} to restart and update.`,
			timeout: 0,
		});
	} else {
		toastManager.update(toastId, {
			type: 'info',
			title: 'DogLog Studio is up to date',
		});
	}
}

/** Check for a newer release, or install the one that was found */
export async function checkOrInstallUpdate(): Promise<void> {
	const state = updateStore.get();
	if (!state) {
		await checkForUpdateManually();
		return;
	}
	if (state.installing) {
		return;
	}

	const toastId = toastManager.add({ type: 'loading', title: `Updating to ${state.update.version}…` });
	await installUpdate(state.update);
	// Only reached if installing failed, which shows its own toast
	toastManager.close(toastId);
}

// Development builds would always find a "newer" release
if (isTauri() && !import.meta.env.DEV) {
	void checkForUpdate();
}

/** The newer desktop release that's available, if any */
export function useUpdate(): UpdateState | undefined {
	return useSelector(updateStore);
}

/** Download and install `update`, then restart into it. On Windows the installer closes Studio and reopens it. */
export async function installUpdate(update: Update): Promise<void> {
	updateStore.set({ update, installing: true });
	try {
		await update.downloadAndInstall();
	} catch (error) {
		updateStore.set({ update, installing: false });
		toastManager.add({ type: 'error', title: "Couldn't update Studio", description: String(error) });
		return;
	}
	await invoke('relaunch');
}
