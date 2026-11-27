// Robots' names for their CAN devices, saved so HOOT logs are still renamed when a project's folder can't be read, ex.
// in the web app before it's allowed to read the folder again. Updated from the projects' configs, see
// `refreshRobotDevices()`.
import { createAtom } from '@tanstack/store';
import { get, set } from 'idb-keyval';
import type { DeviceNames } from '@/three/project-schema';

export type RobotDevices = { readonly robot: string; readonly devices: DeviceNames };

const storageKey = 'doglog-studio:robot-devices';

/** The robots that name devices, in the order they were added, `undefined` until they're loaded */
export const robotDevicesStore = createAtom<readonly RobotDevices[] | undefined>(undefined);

let loading: Promise<void> | undefined;

/** Load the saved device names the first time they're used */
export function loadRobotDevices(): Promise<void> {
	loading ??= get<RobotDevices[]>(storageKey).then((saved) => {
		robotDevicesStore.set((current) => current ?? saved ?? []);
		return undefined;
	});
	return loading;
}

export async function saveRobotDevices(robots: readonly RobotDevices[]): Promise<void> {
	if (JSON.stringify(robots) === JSON.stringify(robotDevicesStore.get())) {
		return;
	}
	robotDevicesStore.set(robots);
	await set(storageKey, robots);
}
