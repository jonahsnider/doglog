import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
import { isTauri } from '@tauri-apps/api/core';
import { relaunch } from '@tauri-apps/plugin-process';
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
	await relaunch();
}
