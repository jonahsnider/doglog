import type { Source } from '@/data/source';
import { simulatorHost } from '@/robot-target';

const probeTimeout = 1000;

/** Whether an NT4 server at `host` accepts a WebSocket connection. The connection is closed right away. */
export async function isReachable(host: string): Promise<boolean> {
	let socket: WebSocket;
	try {
		socket = new WebSocket(`ws://${host}:5810/nt/doglog-studio`, [
			'v4.1.networktables.first.wpi.edu',
			'networktables.first.wpi.edu',
		]);
	} catch {
		// Browsers block insecure connections to some addresses from HTTPS pages. Chrome 147+ allows them with its local
		// network permission, only to IP literals and localhost. Safari always blocks them. The desktop app isn't limited.
		return false;
	}

	let timer: ReturnType<typeof setTimeout> | undefined;
	const reachable = await new Promise<boolean>((resolve) => {
		timer = setTimeout(() => resolve(false), probeTimeout);
		socket.addEventListener('open', () => resolve(true));
		// Also fires when the connection fails
		socket.addEventListener('close', () => resolve(false));
	});
	clearTimeout(timer);
	socket.close();
	return reachable;
}

const retryDelay = 1000;

/**
 * Call `onReachable` with the first of `hosts` with a reachable NT4 server, in order of preference, checking again until
 * one is. Returns a function that stops checking.
 */
export function findReachable(hosts: readonly string[], onReachable: (host: string) => void): () => void {
	let stopped = false;
	let retryTimer: ReturnType<typeof setTimeout> | undefined;
	const attempt = async () => {
		const reachable = await Promise.all(hosts.map((host) => isReachable(host)));
		if (stopped) {
			return;
		}
		const host = hosts.find((_, index) => reachable[index] === true);
		if (host === undefined) {
			retryTimer = setTimeout(() => void attempt(), retryDelay);
		} else {
			onReachable(host);
		}
	};
	void attempt();
	return () => {
		stopped = true;
		clearTimeout(retryTimer);
	};
}

/** Whether connecting to an address space won't show Chrome's Local Network Access permission prompt */
export async function canConnectWithoutPrompt(permission: 'local-network' | 'loopback-network'): Promise<boolean> {
	// Pages served from this computer, ex. the dev server, are never asked, so the permission stays at "prompt"
	if (STUDIO_DESKTOP || /^(localhost|127\.[\d.]+|\[::1\])$|\.localhost$/u.test(location.hostname)) {
		return true;
	}
	try {
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- TypeScript doesn't know the Local Network Access permissions yet
		const status = await navigator.permissions.query({ name: permission as PermissionName });
		return status.state === 'granted';
	} catch {
		// Browsers without Local Network Access don't prompt
		return true;
	}
}

/** What Connect would connect to right now */
export type ConnectTarget = 'robot' | 'simulator';

/**
 * Check what Connect would connect to, without starting a connection.
 * Hosts that would show a permission prompt aren't checked, so this returns `undefined` until the user grants it by connecting.
 */
export async function findConnectTarget(robotHost: string | undefined): Promise<ConnectTarget | undefined> {
	const [robot, simulator] = await Promise.all([
		robotHost !== undefined && (await canConnectWithoutPrompt('local-network')) && isReachable(robotHost),
		(await canConnectWithoutPrompt('loopback-network')) && isReachable(simulatorHost),
	]);
	if (robot) {
		return 'robot';
	}
	return simulator ? 'simulator' : undefined;
}

/**
 * Whether Connect would only reconnect to the server `source` is connected to, reconnecting to, or disconnected from.
 * `target` is what Connect would connect to, `undefined` when nothing is reachable.
 */
export function isSourceTarget(source: Source | undefined, target: ConnectTarget | undefined): boolean {
	if (source?.type !== 'live' || source.status === 'connecting') {
		return false;
	}
	const sourceTarget: ConnectTarget = source.host === simulatorHost ? 'simulator' : 'robot';
	return target === undefined || target === sourceTarget;
}
