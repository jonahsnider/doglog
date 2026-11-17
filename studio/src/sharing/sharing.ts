import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
import { getSharedDocs, removeExpired } from '@/dashboards/sharing';
import { canConnectWithoutPrompt, isReachable } from '@/data/source';
import { getRobotHost, simulatorHost } from '@/robot-target';
import { settingsStore } from '@/settings';
import { trackActivity } from '@/sharing/presence';

/**
 * The NT server shared dashboards are synced through, `undefined` while disconnected.
 * Clear it with `set(() => undefined)`, since atoms ignore `set(undefined)`.
 */
const hostStore = createAtom<string | undefined>(undefined);

export function useSharingHost(): string | undefined {
	return useSelector(hostStore);
}

/** How long to wait before looking for the robot or simulator again */
const retryDelay = 5000;

/**
 * Keep shared dashboards and presence in sync with others connected to the robot, or the simulator when the robot isn't
 * reachable, for as long as the app is open. This connection is separate from the data source.
 */
export function startSharing(): void {
	removeExpired();
	trackActivity();
	let disconnect: (() => void) | undefined;
	let retryTimer: ReturnType<typeof setTimeout> | undefined;
	// Changes whenever the connection is restarted, so outdated attempts can tell
	let generation = 0;

	const restart = () => {
		generation++;
		clearTimeout(retryTimer);
		disconnect?.();
		disconnect = undefined;
		hostStore.set(() => undefined);
		void attempt(generation);
	};

	const retry = (attemptGeneration: number) => {
		if (attemptGeneration === generation) {
			retryTimer = setTimeout(() => void attempt(attemptGeneration), retryDelay);
		}
	};

	async function attempt(attemptGeneration: number): Promise<void> {
		const robotHost = getRobotHost(settingsStore.get().robotTarget);
		const hosts = robotHost === undefined ? [simulatorHost] : [robotHost, simulatorHost];
		// Asking for local network access unprompted would be surprising, unless the user shared a dashboard
		const shared = getSharedDocs().length > 0;
		const reachable = await Promise.all(
			hosts.map(
				async (host) =>
					(shared || (await canConnectWithoutPrompt(host === simulatorHost ? 'loopback-network' : 'local-network'))) &&
					isReachable(host),
			),
		);
		const host = hosts.find((_, index) => reachable[index] === true);
		if (attemptGeneration !== generation) {
			return;
		}
		if (host === undefined) {
			retry(attemptGeneration);
			return;
		}

		// The NT4 client is large, only load it when it's needed
		const { connectSharing } = await import('@/sharing/nt-sync');
		if (attemptGeneration !== generation) {
			return;
		}
		disconnect = connectSharing(host, (connected) => {
			if (attemptGeneration !== generation) {
				return;
			}
			if (connected) {
				hostStore.set(host);
				return;
			}

			// Look for the robot and simulator again, since the other one might be reachable now
			disconnect?.();
			disconnect = undefined;
			hostStore.set(() => undefined);
			retry(attemptGeneration);
		});
	}

	void attempt(generation);
	let robotTarget = settingsStore.get().robotTarget;
	settingsStore.subscribe(({ robotTarget: changed }) => {
		if (changed !== robotTarget) {
			robotTarget = changed;
			restart();
		}
	});
}
