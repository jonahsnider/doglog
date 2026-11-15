import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
import { toastManager } from '@/components/ui/toast';
import { clearData } from '@/data/data-store';
import type { LiveStatus } from '@/data/live-source';
import { loadLog } from '@/data/log-source';
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
}

async function isWpilog(file: File): Promise<boolean> {
	return (await file.slice(0, 6).text()) === 'WPILOG';
}

/** Make a WPILOG file the active source. The current source is kept if the file isn't a WPILOG file. */
export async function openLog(file: File): Promise<void> {
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

/** Make a live NT4 connection to `host` the active source */
export async function connect(host: string): Promise<void> {
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

const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files') ?? false;

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
