// Opens a run's logs as sources, see the log-storage spec's open a run
import { toastManager } from '@/components/toast';
import { openLogPath } from '@/data/open-log';
import { openLog } from '@/data/source';
import { createStorage } from '@/storage/client';
import { teamStorageStore } from '@/storage/team-storage';
import type { Run } from '@/sync/runs';

/**
 * Open a run's logs in order, from the sync folder when they're on this computer, otherwise straight from storage
 * without saving them or adding them to recent logs
 */
export async function openRun(run: Run): Promise<void> {
	const team = teamStorageStore.get();
	const storage = team ? createStorage(team.connection) : undefined;
	for (const log of run.logs) {
		if (log.path !== undefined) {
			// react-doctor-disable-next-line react-doctor/async-await-in-loop -- Opened in order, so the first log is the time base
			await openLogPath(log.path); // oxlint-disable-line no-await-in-loop
			continue;
		}
		if (log.stored === undefined || !storage) {
			continue;
		}
		try {
			// react-doctor-disable-next-line react-doctor/async-await-in-loop -- Same as above
			const contents = await storage.read(log.stored); // oxlint-disable-line no-await-in-loop
			// react-doctor-disable-next-line react-doctor/async-await-in-loop -- Same as above
			await openLog({ name: log.name, contents }); // oxlint-disable-line no-await-in-loop
		} catch (error) {
			toastManager.add({ type: 'error', title: `Couldn't open ${log.name}`, description: String(error) });
		}
	}
}
