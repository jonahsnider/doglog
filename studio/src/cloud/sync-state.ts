import { decodeImportBlobMeta, VersionVector } from 'loro-crdt';
import { base64ToUint8Array, uint8ArrayToBase64 } from 'uint8array-extras';
import * as z from 'zod';
import { docs, idsStore } from '@/dashboards/dashboards';
import { deleteDashboardDoc } from '@/dashboards/doc';
import { createPersistedAtom } from '@/lib/persisted-store';

const stateSchema = z
	.record(
		z.string(),
		z.object({
			/** The last Cloud update imported into the local document */
			pulledSeq: z.number(),
			/** Encoded version vector of everything Cloud already has, unset until this device first uploads */
			pushed: z.string().optional(),
			/** The membership local edits were made under, they're only uploaded while it lasts */
			membershipId: z.string(),
		}),
	)
	.catch({});

export type SyncState = z.infer<typeof stateSchema>[string];

/** How far each Cloud dashboard has synced on this device, by dashboard ID */
const syncStateStore = createPersistedAtom('cloud-sync', stateSchema, {});

export function getSyncState(id: string): SyncState | undefined {
	return syncStateStore.get()[id];
}

export function setSyncState(id: string, state: SyncState | undefined): void {
	syncStateStore.set((states) => {
		const others = Object.fromEntries(Object.entries(states).filter(([other]) => other !== id));
		return state ? { ...others, [id]: state } : others;
	});
}

/** Drop a local copy whose edits can't be uploaded, it's downloaded again from Cloud */
export function discard(id: string): void {
	idsStore.set((ids) => ids.filter((other) => other !== id));
	docs.delete(id);
	deleteDashboardDoc(id);
	setSyncState(id, undefined);
}

export function encodeVersion(version: VersionVector): string {
	return uint8ArrayToBase64(version.encode());
}

export function decodeVersion(encoded: string): VersionVector {
	return VersionVector.decode(base64ToUint8Array(encoded));
}

/** Whether a document has changes Cloud doesn't have yet */
export function hasUnpushed(version: VersionVector, pushed: string | undefined): boolean {
	return pushed === undefined || (version.compare(decodeVersion(pushed)) ?? 1) > 0;
}

/** Add an imported update's changes to what Cloud has, so they aren't uploaded back */
export function includeUpdate(pushed: string, update: Uint8Array): string {
	const merged = decodeVersion(pushed).toJSON();
	for (const [peer, counter] of decodeImportBlobMeta(update, false).partialEndVersionVector.toJSON()) {
		merged.set(peer, Math.max(merged.get(peer) ?? 0, counter));
	}
	return encodeVersion(VersionVector.parseJSON(merged));
}
