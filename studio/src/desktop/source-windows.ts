// Moving sources between the desktop app's windows, see the platforms spec's move sources between windows.
// Windows talk over a BroadcastChannel, which copies a source's data without serializing it to JSON.
import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getRouter } from '@/agent/dashboard-handlers';
import { currentDashboard } from '@/commands/dashboard-commands';
import { toastManager } from '@/components/toast';
import { closeLog, getSources, type Source, sourceName, subscribeSource } from '@/data/source';
import {
	adoptLive,
	adoptLog,
	canAdopt,
	continueLive,
	detachLive,
	type SourceTransfer,
	transferSource,
} from '@/data/source-transfer';
import { createId } from '@/lib/random-id';
import { getTimeline, goLive, seek } from '@/timeline/timeline';

type Playback = ReturnType<typeof getTimeline>['playback'];

/** Another open window, for the Move to menu */
export type WindowInfo = { label: string; title: string; hasLive: boolean };

/** What a window opened for a moved source shows, the same as the window it came from */
type View = { dashboardId: string | undefined; time: number | undefined; playback: Playback };

type Message =
	| { type: 'presence'; window: WindowInfo }
	| { type: 'who' }
	| { type: 'bye'; label: string }
	| { type: 'ready'; label: string }
	| { type: 'hit'; request: string; from: string; x: number; y: number; sourceType: Source['type'] }
	| { type: 'hit-reply'; request: string; label: string; index: number }
	| {
			type: 'move';
			request: string;
			to: string;
			transfer: SourceTransfer;
			recording: string | undefined;
			index: number | undefined;
			view: View | undefined;
	  }
	| { type: 'moved'; request: string };

/** How long to wait for another window to answer, it may be busy loading */
const answerTimeout = 15_000;

const label = STUDIO_DESKTOP ? getCurrentWindow().label : '';
const channel = STUDIO_DESKTOP ? new BroadcastChannel('doglog-studio:windows') : undefined;
const windowsStore = createAtom<ReadonlyMap<string, WindowInfo>>(new Map());
// The source list's element, to tell whether a source was dropped on it
let sourceListElement: HTMLElement | undefined;

function post(message: Message): void {
	// oxlint-disable-next-line unicorn/require-post-message-target-origin -- Broadcast channels have no origin argument
	channel?.postMessage(message);
}

/** Wait for a message from another window that `match` accepts, `undefined` on timeout */
function waitFor<T extends Message>(
	match: (message: Message) => message is T,
	timeout = answerTimeout,
): Promise<T | undefined> {
	return new Promise((resolve) => {
		const listener = ({ data }: MessageEvent<Message>) => {
			if (match(data)) {
				done(data);
			}
		};
		const timer = setTimeout(() => done(undefined), timeout);
		const done = (message: T | undefined) => {
			clearTimeout(timer);
			channel?.removeEventListener('message', listener);
			resolve(message);
		};
		channel?.addEventListener('message', listener);
	});
}

function presence(): WindowInfo {
	return { label, title: document.title, hasLive: getSources().live !== undefined };
}

/** Where this window's top left corner is on the screen, in CSS pixels */
async function windowOrigin(): Promise<{ x: number; y: number }> {
	const window = getCurrentWindow();
	const position = (await window.innerPosition()).toLogical(await window.scaleFactor());
	return { x: position.x, y: position.y };
}

/** Index among the logs a source dropped at `clientY` in the source list goes to */
function dropIndex(list: HTMLElement, clientY: number): number {
	const rows = [...list.querySelectorAll<HTMLElement>('[data-log-index]')];
	const after = rows.filter((row) => {
		const { top, height } = row.getBoundingClientRect();
		return clientY > top + height / 2;
	});
	return after.length;
}

async function handle(message: Message): Promise<void> {
	switch (message.type) {
		case 'presence':
			windowsStore.set((windows) => new Map(windows).set(message.window.label, message.window));
			break;
		case 'who':
			post({ type: 'presence', window: presence() });
			break;
		case 'bye':
			windowsStore.set((windows) => {
				const next = new Map(windows);
				next.delete(message.label);
				return next;
			});
			break;
		case 'hit': {
			const list = sourceListElement;
			if (message.from === label || list === undefined || !canAdopt(message.sourceType)) {
				return;
			}
			const origin = await windowOrigin();
			const rect = list.getBoundingClientRect();
			const x = message.x - origin.x;
			const y = message.y - origin.y;
			if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
				post({ type: 'hit-reply', request: message.request, label, index: dropIndex(list, y) });
			}
			break;
		}
		case 'move':
			if (message.to === label) {
				adopt(message);
			}
			break;
		default:
			break;
	}
}

function adopt({ request, transfer, recording, index, view }: Extract<Message, { type: 'move' }>): void {
	if (transfer.type === 'log') {
		adoptLog(transfer, index);
	} else if (adoptLive(transfer)) {
		void continueLive(recording);
	} else {
		// No room for another live session, the other window keeps it
		return;
	}
	post({ type: 'moved', request });
	if (view === undefined) {
		return;
	}
	void (async () => {
		if (view.dashboardId !== undefined) {
			await getRouter().navigate({ to: '/dashboards/$dashboardId', params: { dashboardId: view.dashboardId } });
		}
		if (view.playback === 'following') {
			goLive();
		} else if (view.time !== undefined) {
			seek(view.time);
		}
	})();
}

/** Whether this window was opened for a moved source, so it doesn't restore a live session of its own */
export const isSourceWindow = label.startsWith('source-window-');

/** Take part in moving sources between windows. Call once when the desktop app starts. */
export function startSourceWindows(): void {
	channel?.addEventListener('message', ({ data }: MessageEvent<Message>) => void handle(data));
	const announce = () => post({ type: 'presence', window: presence() });
	subscribeSource(announce);
	const title = document.querySelector('title');
	if (title) {
		new MutationObserver(announce).observe(title, { childList: true, characterData: true, subtree: true });
	}
	addEventListener('pagehide', () => post({ type: 'bye', label }));
	post({ type: 'who' });
	announce();
	post({ type: 'ready', label });
}

/** Remember the source list's element, to tell whether a source from another window was dropped on it */
export function setSourceListElement(element: HTMLElement | null): void {
	sourceListElement = element ?? undefined;
}

/** The other open windows, for the Move to menu */
export function useOtherWindows(): WindowInfo[] {
	const windows = useSelector(windowsStore);
	return [...windows.values()].filter((window) => window.label !== label);
}

/**
 * Move a source to the window `to`, or to a new window at `at` (CSS pixels on the screen), at `index` among its logs.
 * The source's data goes with it, so nothing is read again.
 */
export async function moveSource(
	source: Source,
	to: { label: string; index?: number } | { at: { x: number; y: number } },
): Promise<void> {
	const transfer = transferSource(source);
	if (transfer === undefined) {
		return;
	}
	let target: string;
	let view: View | undefined;
	if ('label' in to) {
		target = to.label;
	} else {
		const { time, playback } = getTimeline();
		view = { dashboardId: currentDashboard(getRouter())?.id, time, playback };
		target = await invoke<string>('new_source_window', to.at);
		const ready = (message: Message): message is Extract<Message, { type: 'ready' }> =>
			message.type === 'ready' && message.label === target;
		if ((await waitFor(ready)) === undefined) {
			fail(source);
			return;
		}
	}
	// The other window continues the recording, so this one stops writing it first
	const recording = source.type === 'live' ? await detachLive() : undefined;
	const request = createId();
	const moved = waitFor(
		(message): message is Extract<Message, { type: 'moved' }> =>
			message.type === 'moved' && message.request === request,
	);
	post({ type: 'move', request, to: target, transfer, recording, index: 'label' in to ? to.index : undefined, view });
	if ((await moved) === undefined) {
		if (transfer.type === 'live' && adoptLive(transfer)) {
			void continueLive(recording);
		}
		fail(source);
		return;
	}
	if (source.type === 'log') {
		closeLog(source.id);
	}
}

function fail(source: Source): void {
	toastManager.add({
		type: 'error',
		title: `Couldn't move ${sourceName(source)}`,
		description: "The other window didn't answer.",
	});
}

/**
 * Move a source dropped at `x`, `y` (CSS pixels on the screen) outside this window: to the window whose source list
 * it's over, or a new window there. A live session dropped on a window that has one stays here.
 */
export async function dropOutside(source: Source, x: number, y: number): Promise<void> {
	const request = createId();
	const reply = waitFor(
		(message): message is Extract<Message, { type: 'hit-reply' }> =>
			message.type === 'hit-reply' && message.request === request,
		300,
	);
	post({ type: 'hit', request, from: label, x, y, sourceType: source.type });
	const hit = await reply;
	if (hit) {
		await moveSource(source, { label: hit.label, index: hit.index });
		return;
	}
	if (!(await isWindowAt(x, y))) {
		await moveSource(source, { at: { x, y } });
	}
}

/** Whether a Studio window is at `x`, `y` on the screen, where a drop shouldn't open a new window */
async function isWindowAt(x: number, y: number): Promise<boolean> {
	const { getAllWindows } = await import('@tauri-apps/api/window');
	const bounds = await Promise.all(
		(await getAllWindows()).map(async (window) => {
			const [scale, position, size] = await Promise.all([
				window.scaleFactor(),
				window.outerPosition(),
				window.outerSize(),
			]);
			return { position: position.toLogical(scale), size: size.toLogical(scale) };
		}),
	);
	return bounds.some(
		({ position, size }) =>
			x >= position.x && x <= position.x + size.width && y >= position.y && y <= position.y + size.height,
	);
}
