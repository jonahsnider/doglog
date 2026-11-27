import { useMutation, useQuery } from 'convex/react';
import { useEffect } from 'react';
import { api } from '../../../cloud/convex/_generated/api.js';
import type { TeamKey } from '@/cloud/session';
import { decryptConnection, encryptConnection } from '@/storage/connection-crypto';
import { clearTeamStorage, teamStorageStore } from '@/storage/team-storage';

/**
 * Keeps the team's storage connection on this device up to date with Cloud's, and encrypts Cloud's with the current team
 * key after it rotates, from the copy on this device since older team keys aren't kept.
 */
export function TeamStorageSync({ teamKey }: { teamKey: TeamKey }) {
	const stored = useQuery(api.storage.get);
	const reencrypt = useMutation(api.storage.reencrypt);

	useEffect(() => {
		if (stored === undefined) {
			return undefined;
		}
		if (stored === null) {
			clearTeamStorage();
			return undefined;
		}
		let active = true;
		const { teamId, keyVersion, key } = teamKey;
		async function update(encrypted: NonNullable<typeof stored>) {
			if (encrypted.keyVersion === keyVersion) {
				const connection = await decryptConnection(key, { teamId, keyVersion }, encrypted);
				const local = teamStorageStore.get();
				const changed =
					local?.teamId !== teamId ||
					local.keyVersion !== keyVersion ||
					JSON.stringify(local.connection) !== JSON.stringify(connection);
				if (active && changed) {
					teamStorageStore.set({ teamId, keyVersion, connection });
				}
				return;
			}
			const local = teamStorageStore.get();
			if (encrypted.keyVersion < keyVersion && local?.teamId === teamId) {
				const { iv, ciphertext } = await encryptConnection(key, { teamId, keyVersion }, local.connection);
				await reencrypt({ fromKeyVersion: encrypted.keyVersion, keyVersion, iv, ciphertext });
			}
		}
		// A connection this key can't decrypt, ex. one another member is re-encrypting, is picked up when it changes
		update(stored).catch(() => {});
		return () => {
			active = false;
		};
	}, [reencrypt, stored, teamKey]);

	return null;
}
