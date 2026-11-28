// The team's storage connection on this device, kept so storage works without reaching Cloud, see the log-storage spec.
// Kept free of Convex imports like `@/cloud/session`.
import { useSelector } from '@tanstack/react-store';
import { clear, createStore } from 'idb-keyval';
import * as z from 'zod';
import { createPersistedAtom } from '@/lib/persisted-store';
import { connectionSchema } from '@/storage/connection';

const teamStorageSchema = z
	.object({
		teamId: z.string(),
		/** The team key version Cloud's copy is encrypted with, to tell when it needs encrypting with a newer key */
		keyVersion: z.number(),
		connection: connectionSchema,
	})
	.nullable()
	.catch(null);

export type TeamStorage = NonNullable<z.infer<typeof teamStorageSchema>>;

/** The team's decrypted storage connection, `null` without one. Shared by every window. */
export const teamStorageStore = createPersistedAtom('team-storage', teamStorageSchema, null);

export function useTeamStorage(): TeamStorage | null {
	return useSelector(teamStorageStore);
}

/** What Studio read from the storage, see `storage/listing.ts` */
export const listingCache = createStore('doglog-storage', 'listing');

/** Forget the team's storage on this device, ex. after signing out or leaving the team. Logs in the sync folder stay. */
export function clearTeamStorage(): void {
	if (teamStorageStore.get() !== null) {
		teamStorageStore.set(null);
	}
	void clear(listingCache);
}
