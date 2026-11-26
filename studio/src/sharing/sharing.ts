import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
import { getSharedDocs, removeExpired } from '@/dashboards/sharing';
import { canConnectWithoutPrompt, isReachable } from '@/data/connect-target';
import { getRobotHost } from '@/robot-target';
import { settingsStore } from '@/settings';
import { trackActivity } from '@/sharing/presence';

const hostStore = createAtom<string | undefined>(undefined);

export function useSharingHost(): string | undefined {
	return useSelector(hostStore);
}

const disconnectedStatusDuration = 5 * 60 * 1000;
/** Whether shared dashboards were synced recently, so only those using them are told they're disconnected */
const recentlyConnectedStore = createAtom(false);
let disconnectedTimer: ReturnType<typeof setTimeout> | undefined;

export function useRecentlyConnected(): boolean {
	return useSelector(recentlyConnectedStore);
}

function setHost(host: string | undefined): void {
	if (host === hostStore.get()) {
		return;
	}

	hostStore.set(host);
	clearTimeout(disconnectedTimer);
	if (host === undefined) {
		disconnectedTimer = setTimeout(() => recentlyConnectedStore.set(false), disconnectedStatusDuration);
	} else {
		recentlyConnectedStore.set(true);
	}
}

const retryDelay = 5000;

/**
 * Keep shared dashboards and presence in sync with others connected to the robot for as long as the app is open.
 * Simulators are never used for sharing. This connection is separate from the data source.
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
		setHost(undefined);
		void attempt(generation);
	};

	const retry = (attemptGeneration: number) => {
		if (attemptGeneration === generation) {
			retryTimer = setTimeout(() => void attempt(attemptGeneration), retryDelay);
		}
	};

	async function attempt(attemptGeneration: number): Promise<void> {
		const host = getRobotHost(settingsStore.get().robotTarget);
		// Restarted once a robot is set
		if (host === undefined) {
			return;
		}
		// Asking for local network access unprompted would be surprising, unless the user shared a dashboard
		const reachable =
			(getSharedDocs().length > 0 || (await canConnectWithoutPrompt('local-network'))) && (await isReachable(host));
		if (attemptGeneration !== generation) {
			return;
		}
		if (!reachable) {
			retry(attemptGeneration);
			return;
		}

		const modules = await Promise.all([import('@/nt/client'), import('@/sharing/nt-sync')]).catch(() => undefined);
		if (modules === undefined) {
			// A dynamic import can fail on a flaky network or right after a deploy; retry like an unreachable host
			retry(attemptGeneration);
			return;
		}
		const [{ openNt }, { connectSharing }] = modules;
		const nt = await openNt(host);
		if (attemptGeneration !== generation) {
			nt.close();
			return;
		}
		disconnect = connectSharing(nt, (connected) => {
			if (attemptGeneration !== generation) {
				return;
			}
			if (connected) {
				setHost(host);
				return;
			}

			disconnect?.();
			disconnect = undefined;
			setHost(undefined);
			retry(attemptGeneration);
		});
	}

	void attempt(generation);
	// Only when the host changes, so typing a target that isn't valid yet doesn't reconnect to the same server
	let robotHost = getRobotHost(settingsStore.get().robotTarget);
	settingsStore.subscribe(({ robotTarget }) => {
		const changed = getRobotHost(robotTarget);
		if (changed !== robotHost) {
			robotHost = changed;
			restart();
		}
	});
}
