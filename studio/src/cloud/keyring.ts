import type { ConvexReactClient } from 'convex/react';
import { api } from '../../../cloud/convex/_generated/api.js';
import { deriveDashboardKey } from './dashboard-crypto';
import type { CloudSession, TeamKey } from './session';
import { unwrapTeamKey } from './team-key';

/**
 * Returns a function giving each dashboard's key for a team key version, or null if this account can't unlock that
 * version. Earlier versions read updates uploaded before a rotation, until a snapshot replaces them. Failures aren't
 * cached, so they're retried.
 */
export function createKeyring(
	client: ConvexReactClient,
	{ teamId, userId }: CloudSession,
	current: TeamKey,
	accountKey: CryptoKey,
): (dashboardId: string, keyVersion: number) => Promise<CryptoKey | null> {
	const teamKeys = new Map<number, Promise<ArrayBuffer | null>>([[current.keyVersion, Promise.resolve(current.key)]]);
	const dashboardKeys = new Map<string, Promise<CryptoKey | null>>();

	function getTeamKey(keyVersion: number): Promise<ArrayBuffer | null> {
		let key = teamKeys.get(keyVersion);
		if (!key) {
			key = client
				.query(api.teamKeys.getVersion, { keyVersion })
				.then((wrapped) =>
					wrapped ? unwrapTeamKey(wrapped, { teamId, recipientId: userId, keyVersion }, accountKey) : null,
				)
				.catch(() => null)
				.then((unwrapped) => {
					if (!unwrapped) {
						teamKeys.delete(keyVersion);
					}
					return unwrapped;
				});
			teamKeys.set(keyVersion, key);
		}
		return key;
	}

	return (dashboardId, keyVersion) => {
		const cacheKey = JSON.stringify([dashboardId, keyVersion]);
		let key = dashboardKeys.get(cacheKey);
		if (!key) {
			key = getTeamKey(keyVersion).then((base) => {
				if (!base) {
					dashboardKeys.delete(cacheKey);
					return null;
				}
				return deriveDashboardKey(base, { teamId, dashboardId, keyVersion });
			});
			dashboardKeys.set(cacheKey, key);
		}
		return key;
	};
}
