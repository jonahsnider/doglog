import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
import { isTauri } from '@tauri-apps/api/core';
import { toastManager } from '@/components/ui/toast';
import { clearData } from '@/data/data-store';
import { loadDevLog, saveDevLog } from '@/data/dev-log';
import type { LiveStatus } from '@/data/live-source';
import { loadLog } from '@/data/log-source';
import { simulatorHost } from '@/robot-target';
import { resetTimeline } from '@/timeline/timeline';

/** The active data source, shared by every dashboard and widget */
export type Source =
	| { type: 'log'; fileName: string; status: 'loading' | 'loaded' }
	| { type: 'live'; host: string; status: LiveStatus };

const sourceStore = createAtom<Source | undefined>(undefined);
// Kept apart from the source so progress updates don't rerender everything that uses the source
const logProgressStore = createAtom(0);
let stopSource: (() => void) | undefined;
// Changes every time the source is replaced, so slow requests can tell they're outdated
let generation = 0;

export function useSource(): Source | undefined {
	return useSelector(sourceStore);
}

export function getSource(): Source | undefined {
	return sourceStore.get();
}

/** Call `listener` when the active source or its status changes */
export function subscribeSource(listener: () => void): () => void {
	const { unsubscribe } = sourceStore.subscribe(() => listener());
	return unsubscribe;
}

/** Fraction of the loading log parsed so far, from 0 to 1 */
export function useLogProgress(): number {
	return useSelector(logProgressStore);
}

function replaceSource(source: Source | undefined): void {
	stopSource?.();
	stopSource = undefined;
	clearData();
	resetTimeline(source);
	generation++;
	sourceStore.set(source);
	if (import.meta.env.DEV && source?.type !== 'log') {
		void saveDevLog(undefined);
	}
}

/** Close the active source, leaving none */
export function closeSource(): void {
	replaceSource(undefined);
}

async function isWpilog(file: File): Promise<boolean> {
	return (await file.slice(0, 6).text()) === 'WPILOG';
}

/**
 * Make a WPILOG file the active source. The current source is kept if the file isn't a WPILOG file.
 * Returns whether the file started loading.
 */
export async function openLog(file: File): Promise<boolean> {
	const requestedAt = generation;
	if (!(await isWpilog(file))) {
		toastManager.add({ type: 'error', title: `Couldn't open ${file.name}`, description: "It isn't a WPILOG file." });
		return false;
	}
	if (generation !== requestedAt) {
		// Another source was chosen while the file was being checked
		return false;
	}

	logProgressStore.set(0);
	replaceSource({ type: 'log', fileName: file.name, status: 'loading' });
	stopSource = loadLog(file, {
		onProgress: (progress) => logProgressStore.set(progress),
		onLoaded: (damaged) => {
			sourceStore.set({ type: 'log', fileName: file.name, status: 'loaded' });
			if (import.meta.env.DEV) {
				void saveDevLog(file);
			}
			if (damaged) {
				toastManager.add({
					type: 'warning',
					title: `${file.name} is damaged`,
					description: "Some records couldn't be read, showing everything that could be.",
				});
			}
		},
		onError: (message) => {
			replaceSource(undefined);
			toastManager.add({ type: 'error', title: `Couldn't open ${file.name}`, description: message });
		},
	});
	return true;
}

/** Reopen the log that was open before the page reloaded. Only call this in dev. */
export async function reopenDevLog(): Promise<void> {
	const file = await loadDevLog();
	// Keep a source chosen while loading, ex. the log the desktop app was launched with
	if (file !== undefined && sourceStore.get() === undefined) {
		await openLog(file);
	}
}

/** Make a live NT4 connection to `host` the active source */
async function connectToHost(host: string): Promise<void> {
	const source: Source = { type: 'live', host, status: 'connecting' };
	replaceSource(source);
	const requestedAt = generation;
	// The NT4 client is large, only load it when it's needed
	const { connectLive } = await import('@/data/live-source');
	if (generation !== requestedAt) {
		// Replaced while loading
		return;
	}
	stopSource = connectLive(host, (status) => {
		sourceStore.set({ type: 'live', host, status });
	});
}

/** How long connecting waits for a server to accept a connection */
const probeTimeout = 1000;
/** How long connecting waits before trying again when nothing was reachable */
const retryDelay = 1000;

/** Whether an NT4 server at `host` accepts a WebSocket connection. The connection is closed right away. */
export async function isReachable(host: string): Promise<boolean> {
	let socket: WebSocket;
	try {
		socket = new WebSocket(`ws://${host}:5810/nt/doglog-studio`, [
			'v4.1.networktables.first.wpi.edu',
			'networktables.first.wpi.edu',
		]);
	} catch {
		// Browsers block insecure connections to some addresses from HTTPS pages
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

/** Whether connecting to an address space won't show Chrome's Local Network Access permission prompt */
export async function canConnectWithoutPrompt(permission: 'local-network' | 'loopback-network'): Promise<boolean> {
	// Pages served from this computer, ex. the dev server, are never asked, so the permission stays at "prompt"
	if (isTauri() || /^(localhost|127\.[\d.]+|\[::1\])$|\.localhost$/u.test(location.hostname)) {
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
 * Whether Connect would only reconnect to the server `source` is connected or reconnecting to, throwing away its data.
 * `target` is what Connect would connect to, `undefined` when nothing is reachable.
 */
export function isSourceTarget(source: Source | undefined, target: ConnectTarget | undefined): boolean {
	if (source?.type !== 'live' || source.status === 'connecting') {
		return false;
	}
	const sourceTarget: ConnectTarget = source.host === simulatorHost ? 'simulator' : 'robot';
	return target === undefined || target === sourceTarget;
}

/**
 * Connect to the robot at `robotHost` if it's reachable, otherwise to the simulator.
 * Keeps trying both until one is reachable, only tries the simulator without a robot host.
 * While a live source is connected or reconnecting, this only switches to another target that's reachable.
 */
export async function connect(robotHost: string | undefined): Promise<void> {
	const current = sourceStore.get();
	if (current?.type === 'live' && current.status !== 'connecting') {
		const target = await findConnectTarget(robotHost);
		// Also skipped when the source changed while checking, ex. it reconnected
		if (sourceStore.get() !== current || isSourceTarget(current, target)) {
			return;
		}
	}

	const hosts = robotHost === undefined ? [simulatorHost] : [robotHost, simulatorHost];
	replaceSource({ type: 'live', host: hosts.join(' or '), status: 'connecting' });
	const requestedAt = generation;
	let retryTimer: ReturnType<typeof setTimeout> | undefined;
	stopSource = () => clearTimeout(retryTimer);

	const attempt = async () => {
		const reachable = await Promise.all(hosts.map((host) => isReachable(host)));
		if (generation !== requestedAt) {
			// Another source was chosen while checking
			return;
		}

		// Hosts are in order of preference
		const host = hosts.find((_, index) => reachable[index] === true);
		if (host === undefined) {
			retryTimer = setTimeout(() => void attempt(), retryDelay);
		} else {
			void connectToHost(host);
		}
	};
	void attempt();
}
