import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { toastManager } from '@/components/ui/toast';
import {
	addRecentLog,
	addRecentLogHandle,
	removeRecentLog,
	removeRecentLogHandle,
	supportsFileHandles,
} from '@/data/recent-logs';
import { openLog } from '@/data/source';

async function chooseLogWithDialog(): Promise<void> {
	const path = await openDialog({ filters: [{ name: 'WPILOG', extensions: ['wpilog'] }] });
	if (path !== null) {
		await openLogPath(path);
	}
}

/** Pick a log with the File System Access API, which gives a handle that can be kept in the recent logs */
async function chooseLogWithPicker(): Promise<void> {
	let handles: FileSystemFileHandle[];
	try {
		handles = await window.showOpenFilePicker!({
			types: [{ description: 'WPILOG', accept: { 'application/octet-stream': ['.wpilog'] } }],
		});
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') {
			// The user closed the picker
			return;
		}
		throw error;
	}
	await openLogHandle(handles[0]!);
}

async function openLogHandle(handle: FileSystemFileHandle): Promise<void> {
	let file: File;
	try {
		file = await handle.getFile();
	} catch (error) {
		// Ex. a recent log that was moved or deleted
		void removeRecentLogHandle(handle);
		toastManager.add({ type: 'error', title: `Couldn't open ${handle.name}`, description: String(error) });
		return;
	}
	if (await openLog(file)) {
		void addRecentLogHandle(handle);
	}
}

/** Reopen one of the web app's recent logs. Call this during a click, since the browser may ask to read the file again. */
export async function openRecentLogHandle(handle: FileSystemFileHandle): Promise<void> {
	if ((await handle.requestPermission({ mode: 'read' })) === 'granted') {
		await openLogHandle(handle);
	}
}

/** Let the user pick a WPILOG file to open */
export function chooseLog(): void {
	// The desktop app's menu can't open the web file picker, since it only opens during a click or key press in the page
	if (isTauri()) {
		void chooseLogWithDialog();
		return;
	}
	if (supportsFileHandles) {
		void chooseLogWithPicker();
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

/** Open a log from the desktop app's file system, and add it to the recent logs. Returns whether it started loading. */
export async function openLogPath(path: string, onError?: (message: string) => void): Promise<boolean> {
	const fileName = path.split(/[/\\]/u).at(-1)!;
	let contents: ArrayBuffer;
	try {
		contents = await invoke<ArrayBuffer>('read_file', { path });
	} catch (error) {
		// Ex. a recent log that was moved or deleted
		removeRecentLog(path);
		toastManager.add({ type: 'error', title: `Couldn't open ${fileName}`, description: String(error) });
		onError?.(String(error));
		return false;
	}
	const opened = await openLog(new File([contents], fileName), onError);
	if (opened) {
		addRecentLog(path);
	}
	return opened;
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
			// The handle has to be requested before the event ends
			const handle = supportsFileHandles ? event.dataTransfer.items[0]?.getAsFileSystemHandle?.() : undefined;
			void openDroppedLog(file, handle);
		}
	});
}

async function openDroppedLog(file: File, handle: Promise<FileSystemHandle | null> | undefined): Promise<void> {
	if (!(await openLog(file))) {
		return;
	}
	const resolved = await handle;
	if (resolved instanceof FileSystemFileHandle) {
		await addRecentLogHandle(resolved);
	}
}

/** Open WPILOG files the OS asks the installed web app to open, see `file_handlers` in the web app manifest */
export function handleLaunchedLogFiles(): void {
	window.launchQueue?.setConsumer(({ files }) => {
		const handle = files[0];
		if (handle instanceof FileSystemFileHandle) {
			void openLogHandle(handle);
		}
	});
}
