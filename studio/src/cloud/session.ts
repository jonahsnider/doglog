// Cloud state the rest of Studio reads, kept free of Convex imports so dashboards can use it without loading Cloud
import { createAtom } from '@tanstack/store';
import * as z from 'zod';
import { toastManager } from '@/components/toast';
import { createPersistedAtom } from '@/lib/persisted-store';
import type { Id } from '../../../cloud/convex/_generated/dataModel';

const idSchema = <Table extends 'users' | 'teams' | 'memberships'>() =>
	z.custom<Id<Table>>((value) => typeof value === 'string');

/** The signed-in profile, including accounts without a team or a display name. Kept while offline. */
export const cloudAccountStore = createPersistedAtom(
	'cloud-account',
	z.object({ displayName: z.string().nullable() }).nullable(),
	null,
);

const sessionSchema = z
	.object({ userId: idSchema<'users'>(), teamId: idSchema<'teams'>(), membershipId: idSchema<'memberships'>() })
	.nullable()
	.catch(null);

/**
 * The signed-in account's team membership, kept while offline. Cleared on sign-out, which hides the team's dashboards.
 * Shared by every window.
 */
export const cloudSessionStore = createPersistedAtom('cloud-session', sessionSchema, null);

export type CloudSession = NonNullable<z.infer<typeof sessionSchema>>;

export interface TeamKey {
	teamId: Id<'teams'>;
	keyVersion: number;
	key: ArrayBuffer;
}

export type AccountKeyState = { status: 'loading' | 'missing' | 'error' } | { status: 'ready'; key: CryptoKey };

/** This browser's account private key, unlocked in memory while signed in */
export const accountKeyStore = createAtom<AccountKeyState>({ status: 'loading' });
/** Bumped to unlock the account key again, ex. after pairing */
export const accountKeyAttemptStore = createAtom(0);
/** The current team key, or whether it couldn't be unlocked */
export const teamKeyStore = createAtom<TeamKey | 'failed' | undefined>(undefined);
/** Whether this window is connected to Cloud with the current team key, so team dashboards can be shared and closed */
export const cloudReadyStore = createAtom(false);

/** The sharing scope of a team's Cloud dashboards, see `DashboardSharing` */
export function cloudScope(teamId: string): string {
	return `cloud:${teamId}`;
}

/** Team dashboard changes that reach everyone need a live Cloud connection and aren't queued. Shows why when there's none. */
export function requireCloud(needed: boolean, action: string): boolean {
	if (!needed || cloudReadyStore.get()) {
		return true;
	}
	toastManager.add({ type: 'error', title: `Connect to DogLog Cloud to ${action}` });
	return false;
}

export function isCloudScope(scope: string | undefined): boolean {
	return scope?.startsWith('cloud:') === true;
}

export function currentCloudScope(): string | undefined {
	const session = cloudSessionStore.get();
	return session ? cloudScope(session.teamId) : undefined;
}
