import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { toastManager } from '@/components/ui/toast';
import { clearData } from '@/data/data-store';
import { loadDevLog, saveDevLog } from '@/data/dev-log';
import type { LiveStatus } from '@/data/live-source';
import { loadLog } from '@/data/log-source';
import { simulatorHost } from '@/robot-target';
import { resetTimeline } from '@/timeline';

/** The active data source, shared by every dashboard and widget */
export type Source =
	| { type: 'log'; fileName: string; status: 'loading' | 'loaded' }
	| { type: 'live'; host: string; status: LiveStatus };

const sourceStore = createAtom<Source | undefined>(undefined);
let stopSource: (() => void) | undefined;
// Changes every time the source is replaced, so slow requests can tell they're outdated
let generation = 0;

export function useSource(): Source | undefined {
	return useSelector(sourceStore);
}

function replaceSource(source: Source | undefined): void {
	stopSource?.();
	stopSource = undefined;
	clearData();
	resetTimeline(source?.type === 'live');
	generation++;
	sourceStore.set(source);
	if (import.meta.env.DEV && source?.type !== 'log') {
		void saveDevLog(undefined);
	}
}

async function isWpilog(file: File): Promise<boolean> {
	return (await file.slice(0, 6).text()) === 'WPILOG';
}

/** Make a WPILOG file the active source. The current source is kept if the file isn't a WPILOG file. */
async function openLog(file: File): Promise<void> {
	const requestedAt = generation;
	if (!(await isWpilog(file))) {
		toastManager.add({ type: 'error', title: `Couldn't open ${file.name}`, description: "It isn't a WPILOG file." });
		return;
	}
	if (generation !== requestedAt) {
		// Another source was chosen while the file was being checked
		return;
	}

	replaceSource({ type: 'log', fileName: file.name, status: 'loading' });
	stopSource = loadLog(file, {
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
async function isReachable(host: string): Promise<boolean> {
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

/**
 * Connect to the robot at `robotHost` if it's reachable, otherwise to the simulator.
 * Keeps trying both until one is reachable, only tries the simulator without a robot host.
 */
export function connect(robotHost: string | undefined): void {
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

async function chooseLogWithDialog(): Promise<void> {
	const path = await openDialog({ filters: [{ name: 'WPILOG', extensions: ['wpilog'] }] });
	if (path !== null) {
		await openLogPath(path);
	}
}

/** Let the user pick a WPILOG file to open */
export function chooseLog(): void {
	// The desktop app's menu can't open the web file picker, since it only opens during a click or key press in the page
	if (isTauri()) {
		void chooseLogWithDialog();
		return;
	}

	const input = document.createElement('input');
	input.type = 'file';
	input.accept = '.wpilog';
	input.addEventListener('change', () => {
		const file = input.files?.[0];
		if (file) {
			void openLog(file);
		}
	});
	input.click();
}

/** Whether a drag event is dragging files from outside the window */
export const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files') ?? false;

/** Open the last log the OS asked the desktop app to open, if it hasn't been opened yet */
async function openTakenLog(): Promise<void> {
	const path = await invoke<string | null>('take_opened_log');
	if (path !== null) {
		await openLogPath(path);
	}
}

/** Open a log from the desktop app's file system */
async function openLogPath(path: string): Promise<void> {
	const fileName = path.split(/[/\\]/u).at(-1)!;
	let contents: ArrayBuffer;
	try {
		contents = await invoke<ArrayBuffer>('read_file', { path });
	} catch (error) {
		toastManager.add({ type: 'error', title: `Couldn't open ${fileName}`, description: String(error) });
		return;
	}
	await openLog(new File([contents], fileName));
}

/** Open WPILOG files the OS asks the desktop app to open, ex. when one is double-clicked */
export async function handleOpenedLogFiles(): Promise<void> {
	await listen('log-opened', () => void openTakenLog());
	// Logs opened before the listener was added, ex. the one that launched the app
	await openTakenLog();
}

/** Open WPILOG files dropped anywhere on the window */
export function handleLogFileDrops(): void {
	window.addEventListener('dragover', (event) => {
		if (hasFiles(event)) {
			event.preventDefault();
			event.dataTransfer!.dropEffect = 'copy';
		}
	});

	window.addEventListener('drop', (event) => {
		const file = event.dataTransfer?.files[0];
		if (file) {
			event.preventDefault();
			void openLog(file);
		}
	});
}
