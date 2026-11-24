import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../../cloud/convex/_generated/api.js';
import type { Id } from '../../../cloud/convex/_generated/dataModel';
import { type TeamKey, teamKeyStore } from './session';
import { createTeamKey, unwrapTeamKey, wrapTeamKey } from './team-key';

type Grant = NonNullable<FunctionReturnType<typeof api.teamKeys.getMine>>;
type AccountKeyAttestation = NonNullable<FunctionReturnType<typeof api.users.getMyEncryptionKey>>;

interface Publish {
	initialize: (wrappedKey: ArrayBuffer) => Promise<unknown>;
	rotate: (keyVersion: number, grants: { userId: Id<'users'>; wrappedKey: ArrayBuffer }[]) => Promise<unknown>;
}

// Returns undefined after publishing a new team key, which arrives as a new grant.
async function unlockTeamKey(
	grant: Grant,
	userId: Id<'users'>,
	accountKey: CryptoKey,
	ownKey: AccountKeyAttestation,
	trustedCloudKey: ArrayBuffer,
	publish: Publish,
): Promise<TeamKey | undefined> {
	if (grant.keyVersion === null) {
		const context = { teamId: grant.teamId, recipientId: userId, keyVersion: 1 };
		await publish.initialize(await wrapTeamKey(createTeamKey(), context, ownKey, trustedCloudKey));
		return undefined;
	}
	if (grant.wrappedKey === null) {
		throw new Error('This account has no grant for the current team key.');
	}
	if (grant.rotation) {
		// A membership ended, so seal a fresh key to each remaining member's attested account key. Cloud rejects the
		// rotation if the members changed or another teammate rotated first; the next grant update retries.
		const keyVersion = grant.keyVersion + 1;
		const teamKey = createTeamKey();
		const grants = await Promise.all(
			grant.rotation.recipients.map(async (recipient) => {
				if (!recipient.encryptionKey) {
					throw new Error('A team member has no account encryption key.');
				}
				const context = { teamId: grant.teamId, recipientId: recipient.userId, keyVersion };
				const wrappedKey = await wrapTeamKey(teamKey, context, recipient.encryptionKey, trustedCloudKey);
				return { userId: recipient.userId, wrappedKey };
			}),
		);
		await publish.rotate(keyVersion, grants).catch(() => undefined);
		return undefined;
	}
	const context = { teamId: grant.teamId, recipientId: userId, keyVersion: grant.keyVersion };
	return { ...context, key: await unwrapTeamKey(grant.wrappedKey, context, accountKey) };
}

/**
 * Unlocks the team key with the account key, publishes the first and rotated keys, and completes pending invite joins.
 * The key is also shared through `teamKeyStore`.
 */
export function useTeamKey(userId: Id<'users'>, accountKey: CryptoKey) {
	const grant = useQuery(api.teamKeys.getMine);
	const ownKey = useQuery(api.users.getMyEncryptionKey);
	const trustedCloudKey = useQuery(api.users.getAttestationKey);
	const pendingJoins = useQuery(api.teamKeys.listPendingJoins);
	const initialize = useMutation(api.teamKeys.initialize);
	const completeJoin = useMutation(api.teamKeys.completeJoin);
	const rotate = useMutation(api.teamKeys.rotate);
	const [result, setResult] = useState<{ grant: typeof grant; teamKey?: TeamKey; failed: boolean }>();
	const attempted = useRef(new Set<string>());
	const current = result?.grant === grant ? result : undefined;
	const teamKey = current?.teamKey;

	useEffect(() => {
		let active = true;
		async function unlock() {
			if (!grant || !ownKey || !trustedCloudKey) {
				return;
			}
			try {
				const key = await unlockTeamKey(grant, userId, accountKey, ownKey, trustedCloudKey, {
					initialize: (wrappedKey) => initialize({ teamId: grant.teamId, wrappedKey }),
					rotate: (keyVersion, grants) => rotate({ keyVersion, grants }),
				});
				if (active && key) {
					setResult({ grant, teamKey: key, failed: false });
				}
			} catch {
				if (active) {
					setResult({ grant, failed: true });
				}
			}
		}
		void unlock();
		return () => {
			active = false;
		};
	}, [accountKey, grant, initialize, ownKey, rotate, trustedCloudKey, userId]);

	useEffect(() => {
		if (!teamKey || !trustedCloudKey || !pendingJoins) {
			return;
		}
		const joins = pendingJoins.filter(
			(join) => join.keyVersion === teamKey.keyVersion && !attempted.current.has(join.id),
		);
		for (const join of joins) {
			attempted.current.add(join.id);
		}
		// wrapTeamKey refuses a recipient key without a valid Cloud attestation, and completeJoin rechecks the invite.
		void Promise.all(
			joins.map(async (join) => {
				try {
					const context = { teamId: teamKey.teamId, recipientId: join.userId, keyVersion: join.keyVersion };
					const wrappedKey = await wrapTeamKey(teamKey.key, context, join.encryptionKey, trustedCloudKey);
					await completeJoin({ pendingJoinId: join.id, keyVersion: join.keyVersion, wrappedKey });
				} catch {
					// Another teammate may have finished it, or it may be invalid. Retry when the pending list changes.
					attempted.current.delete(join.id);
				}
			}),
		);
	}, [completeJoin, pendingJoins, teamKey, trustedCloudKey]);

	const failed = current?.failed === true;
	useEffect(() => {
		teamKeyStore.set(failed ? 'failed' : teamKey);
	}, [failed, teamKey]);
	useEffect(() => () => teamKeyStore.set(undefined), []);
	return teamKey;
}
