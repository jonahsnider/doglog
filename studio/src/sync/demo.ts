// Demo mode pretends to sync from a robot with made-up logs, for trying sync without one. It's removed before release.
import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
import { type SyncBackend, trackEnabled } from '@/sync/backend';
import type { RemoteLog } from '@/sync/plan';

export interface DemoState {
	reachable: boolean;
	robotEnabled: boolean;
	/** Make the next copy fail, to see how errors look */
	failNextCopy: boolean;
	robotLogs: RemoteLog[];
	/** Bytes of each log that are "saved" in the sync folder, by name */
	savedLogs: Record<string, number>;
}

const hourMs = 60 * 60 * 1000;
const dayMs = 24 * hourMs;
const mb = 1_000_000;
/** How often a demo copy makes progress */
const tickMs = 100;
/** Copies go at 25 MB/s */
const bytesPerTick = 2.5 * mb;

/** A WPILib log name for a log started at `date`, ex. `FRC_20261115_143000_DEMO_Q12.wpilog` */
function logName(date: Date, match?: string): string {
	const [day, time] = date.toISOString().slice(0, 19).replaceAll('-', '').replaceAll(':', '').split('T');
	return `FRC_${day}_${time}${match === undefined ? '' : `_DEMO_${match}`}.wpilog`;
}

function robotLog(date: Date, size: number, match?: string): RemoteLog {
	const name = logName(date, match);
	return { path: `/U/logs/${name}`, name, size };
}

/** Three days of logs ending now: practice in the pits and on the field, qualifications, and eliminations */
function initialRobotLogs(): RemoteLog[] {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const at = (daysAgo: number, hours: number) => new Date(today.getTime() - daysAgo * dayMs + hours * hourMs);
	const now = Date.now();

	return [
		...[9, 10.25, 11.5, 14].map((hours) => robotLog(at(2, hours), 8 * mb + hours * mb)),
		robotLog(at(2, 15.5), 12 * mb, 'P1'),
		robotLog(at(2, 16.5), 11 * mb, 'P2'),
		...Array.from({ length: 12 }, (_, index) =>
			robotLog(at(1, 8 + index / 2), 20 * mb + ((index * 7) % 20) * mb, `Q${index + 1}`),
		),
		...[3, 2, 1].map((hoursAgo, index) =>
			robotLog(new Date(now - hoursAgo * hourMs), 30 * mb + index * 5 * mb, `E${index + 1}`),
		),
	];
}

const demoStore = createAtom<DemoState>({
	reachable: true,
	robotEnabled: false,
	failNextCopy: false,
	robotLogs: initialRobotLogs(),
	savedLogs: {},
});

export function useDemo(): DemoState {
	return useSelector(demoStore);
}

export function updateDemo(changes: Partial<DemoState>): void {
	demoStore.set((state) => ({ ...state, ...changes }));
}

/** Put a new elimination match log on the robot, like one that just finished */
export function addDemoMatch(): void {
	const { robotLogs } = demoStore.get();
	const match = robotLogs.filter((log) => log.name.includes('_DEMO_E')).length + 1;
	updateDemo({ robotLogs: [...robotLogs, robotLog(new Date(), 40 * mb, `E${match}`)] });
}

/** Start over with the original logs on the robot and nothing synced */
export function resetDemo(): void {
	updateDemo({ robotLogs: initialRobotLogs(), savedLogs: {} });
}

let cancelled = false;

async function delay(ms: number): Promise<void> {
	await new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

export const demoBackend: SyncBackend = {
	listRobotLogs: async (host) => {
		await delay(300);
		if (!demoStore.get().reachable) {
			throw new Error(`Couldn't connect to ${host}`);
		}
		return demoStore.get().robotLogs;
	},
	listSavedLogs: () =>
		Promise.resolve(Object.entries(demoStore.get().savedLogs).map(([name, size]) => ({ name, size }))),
	createFolder: () => Promise.resolve(),
	deleteLog: (_folder, name) => {
		const { [name]: _deleted, ...savedLogs } = demoStore.get().savedLogs;
		updateDemo({ savedLogs });
		return Promise.resolve();
	},
	download: async (host, log, _folder, offset, onProgress) => {
		cancelled = false;
		let copied = 0;
		while (offset + copied < log.size) {
			// oxlint-disable-next-line no-await-in-loop -- Copies one chunk at a time, like a real download
			await delay(tickMs);
			if (cancelled) {
				break;
			}
			const { reachable, failNextCopy, savedLogs } = demoStore.get();
			if (!reachable) {
				throw new Error(`Lost the connection to ${host}`);
			}
			if (failNextCopy) {
				updateDemo({ failNextCopy: false });
				throw new Error(`Couldn't copy ${log.name}, demo mode was told to fail`);
			}
			copied += Math.min(bytesPerTick, log.size - offset - copied);
			updateDemo({ savedLogs: { ...savedLogs, [log.name]: offset + copied } });
			onProgress(copied);
		}
		return copied;
	},
	cancelDownload: () => {
		cancelled = true;
	},
	disconnect: () => Promise.resolve(),
	watchRobotEnabled: (_host, onChange) => {
		const enabled = trackEnabled(onChange);
		enabled.set(demoStore.get().robotEnabled);
		const subscription = demoStore.subscribe(({ robotEnabled }) => enabled.set(robotEnabled));
		return Promise.resolve({ pausedFor: enabled.pausedFor, stop: () => subscription.unsubscribe() });
	},
};
