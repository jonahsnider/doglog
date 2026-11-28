import { useSelector } from '@tanstack/react-store';
import * as z from 'zod';
import { createPersistedAtom } from '@/lib/persisted-store';

const syncSettingsSchema = z.object({
	enabled: z.boolean().catch(false),
	/** Whether the user ever started sync. Until then the sync folder isn't read, since that asks for access to Documents. */
	started: z.boolean().catch(false),
	/** Folder logs are synced to, `null` for the default folder */
	folder: z.string().nullable().catch(null),
	/** Only sync logs from this many days before now */
	days: z.int().min(1).catch(14),
	/** Only sync logs from matches run by the field */
	officialOnly: z.boolean().catch(false),
	/** Most gigabytes of logs to keep in the sync folder, `null` for no limit */
	capGb: z.number().positive().nullable().catch(null),
	/** With a storage limit and team storage, only delete logs that are uploaded */
	onlyDeleteUploaded: z.boolean().catch(true),
	/** Whether logs and files upload to the team's storage, paused separately from copying from the robot */
	uploadsEnabled: z.boolean().catch(true),
	/** Sync from a pretend robot with made-up logs, for testing. Only development builds can turn it on. */
	demo: z.boolean().catch(false),
});

export type SyncSettings = z.infer<typeof syncSettingsSchema>;

/** Log sync settings, apart from the robot connection setting which sync shares with Connect */
export const syncSettingsStore = createPersistedAtom('log-sync', syncSettingsSchema, syncSettingsSchema.parse({}));

export function useSyncSettings(): SyncSettings {
	return useSelector(syncSettingsStore);
}

export function updateSyncSettings(changes: Partial<SyncSettings>): void {
	syncSettingsStore.set((settings) => ({ ...settings, ...changes }));
}
