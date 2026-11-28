import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { useSelector } from '@tanstack/react-store';
import { useAction, useConvex, useConvexAuth, useQuery } from 'convex/react';
import { type ReactNode, useEffect } from 'react';
import { api } from '../../../cloud/convex/_generated/api.js';
import type { Id } from '../../../cloud/convex/_generated/dataModel';
import { unlockAccountKey } from './account-key';
import { startCloudSync } from './cloud-sync';
import { cloudClient } from './deployment';
import {
	accountKeyAttemptStore,
	accountKeyStore,
	cloudAccountStore,
	type CloudSession,
	cloudReadyStore,
	cloudSessionStore,
	type TeamKey,
	teamDefaultsStore,
} from './session';
import { useTeamKey } from './team-keys';
import { clearTeamStorage, teamStorageStore } from '@/storage/team-storage';
import { TeamStorageSync } from '@/storage/team-storage-sync';

// The desktop sign-in page sends the OAuth code to the app, so the website mustn't redeem it itself.
const ambientSignIns = location.pathname === '/desktop-sign-in' ? [] : undefined;

/** Signs in to Cloud for the whole app, and keeps the team's keys and dashboards available while signed in */
export function CloudProvider({ children }: { children: ReactNode }) {
	return (
		<ConvexAuthProvider client={cloudClient} api={api.auth} ambientSignIns={ambientSignIns}>
			<CloudBackground />
			{children}
		</ConvexAuthProvider>
	);
}

function CloudBackground() {
	const { isLoading, isAuthenticated } = useConvexAuth();
	useEffect(() => {
		if (!isLoading && !isAuthenticated) {
			cloudAccountStore.set(null);
			cloudSessionStore.set(null);
			teamDefaultsStore.set(null);
			clearTeamStorage();
		}
	}, [isAuthenticated, isLoading]);
	return isAuthenticated ? <SignedIn /> : null;
}

function SignedIn() {
	const account = useQuery(api.users.getCurrent);
	const team = useQuery(api.teams.getMine);
	// Unlocking again, ex. after pairing, starts over with a fresh component
	const attempt = useSelector(accountKeyAttemptStore);
	useEffect(() => {
		if (account !== undefined) {
			cloudAccountStore.set(account === null ? null : { displayName: account.displayName });
		}
	}, [account]);
	useEffect(() => {
		if (account === null || team === null) {
			cloudSessionStore.set(null);
			teamDefaultsStore.set(null);
			clearTeamStorage();
		} else if (account && team) {
			const storageTeam = teamStorageStore.get()?.teamId;
			if (storageTeam !== undefined && storageTeam !== team.id) {
				clearTeamStorage();
			}
			const { teamNumber } = team.defaults;
			teamDefaultsStore.set((current) => (current?.teamNumber === teamNumber ? current : { teamNumber }));
			const session = { userId: account.id, teamId: team.id, membershipId: team.membershipId };
			cloudSessionStore.set((current) =>
				current?.userId === session.userId &&
				current.teamId === session.teamId &&
				current.membershipId === session.membershipId
					? current
					: session,
			);
		}
	}, [account, team]);
	return account ? <AccountKey key={`${account.id}:${attempt}`} userId={account.id} /> : null;
}

function AccountKey({ userId }: { userId: Id<'users'> }) {
	const { url } = useConvex();
	const registeredKey = useQuery(api.users.getMyEncryptionKey);
	const register = useAction(api.users.registerEncryptionKey);
	const state = useSelector(accountKeyStore);
	const session = useSelector(cloudSessionStore);

	useEffect(() => {
		let active = true;
		async function unlock() {
			if (registeredKey === undefined) {
				return;
			}
			try {
				const key = await unlockAccountKey(url, userId, registeredKey?.publicKey ?? null, async (publicKey) => {
					if (active) {
						await register({ userId, publicKey });
					}
				});
				if (active) {
					accountKeyStore.set(key ? { status: 'ready', key } : { status: 'missing' });
				}
			} catch {
				if (active) {
					accountKeyStore.set({ status: 'error' });
				}
			}
		}
		void unlock();
		return () => {
			active = false;
		};
	}, [registeredKey, register, url, userId]);
	useEffect(() => () => accountKeyStore.set({ status: 'loading' }), []);

	return state.status === 'ready' && session?.userId === userId ? (
		<TeamKeys session={session} accountKey={state.key} />
	) : null;
}

function TeamKeys({ session, accountKey }: { session: CloudSession; accountKey: CryptoKey }) {
	const teamKey = useTeamKey(session.userId, accountKey);
	return teamKey?.teamId === session.teamId ? (
		<CloudSync session={session} teamKey={teamKey} accountKey={accountKey} />
	) : null;
}

function CloudSync({
	session,
	teamKey,
	accountKey,
}: {
	session: CloudSession;
	teamKey: TeamKey;
	accountKey: CryptoKey;
}) {
	const client = useConvex();

	useEffect(() => {
		const update = () => cloudReadyStore.set(client.connectionState().isWebSocketConnected);
		update();
		const unsubscribe = client.subscribeToConnectionState(update);
		return () => {
			unsubscribe();
			cloudReadyStore.set(false);
		};
	}, [client]);

	useEffect(() => {
		// One window per device syncs, the others follow its changes through local storage
		const controller = new AbortController();
		let stop: (() => void) | undefined;
		navigator.locks
			.request(
				`doglog-cloud-sync:${client.url}`,
				{ signal: controller.signal },
				() =>
					new Promise<void>((resolve) => {
						stop = startCloudSync(client, session, teamKey, accountKey);
						controller.signal.addEventListener('abort', () => resolve(), { once: true });
					}),
			)
			.catch(() => {
				// Aborted before this window got the lock
			});
		return () => {
			controller.abort();
			stop?.();
		};
	}, [accountKey, client, session, teamKey]);

	return <TeamStorageSync teamKey={teamKey} />;
}
