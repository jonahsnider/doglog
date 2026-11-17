import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { toastManager } from '@/components/ui/toast';

/** A newer desktop release, and whether it's being installed */
type UpdateState = { update: Update; installing: boolean };

const updateStore = createAtom<UpdateState | undefined>(undefined);

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

/** Check for a newer release when the user asks, telling them if there isn't one */
export async function checkForUpdateManually(): Promise<void> {
	if (updateStore.get()?.installing === true) {
		return;
	}

	let update: Update | null;
	try {
		update = await check();
	} catch (error) {
		toastManager.add({ type: 'error', title: "Couldn't check for updates", description: String(error) });
		return;
	}

	if (update) {
		updateStore.set({ update, installing: false });
	} else {
		toastManager.add({ type: 'info', title: "You're on the latest version", description: `Studio ${STUDIO_VERSION}` });
	}
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
