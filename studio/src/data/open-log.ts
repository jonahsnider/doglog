import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { toastManager } from '@/components/toast';
import { logFileExtension } from '@/data/log-source';
import { openLogUrl } from '@/data/open-log-url';
import {
	addRecentLog,
	addRecentLogHandle,
	removeRecentLog,
	removeRecentLogHandle,
	supportsFileHandles,
} from '@/data/recent-logs';
import { openLog } from '@/data/source';
import { handleFileDrops } from '@/desktop/file-drop';

const logExtensions = ['.wpilog', '.wpilogxz', '.hoot'] as const;

async function chooseLogWithDialog(): Promise<void> {
	const paths = await openDialog({
		multiple: true,
		filters: [{ name: 'Robot logs', extensions: logExtensions.map((extension) => extension.slice(1)) }],
	});
	await openLogPaths(paths ?? []);
}

/** Pick a log with the File System Access API, which gives a handle that can be kept in the recent logs */
async function chooseLogWithPicker(): Promise<void> {
	let handles: FileSystemFileHandle[];
	try {
		handles = await window.showOpenFilePicker!({
			multiple: true,
			types: [{ description: 'Robot logs', accept: { 'application/octet-stream': [...logExtensions] } }],
		});
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') {
			// The user closed the picker
			return;
		}
		throw error;
	}
	await openInOrder(handles, openLogHandle);
}

/**
 * Open several logs one after another, so they're added to the source list in the order given. Each one has started
 * loading before the next is opened.
 */
async function openInOrder<T>(items: readonly T[], open: (item: T) => Promise<unknown>): Promise<void> {
	// Opening them at once could add them in any order
	await items.reduce<Promise<unknown>>((previous, item) => previous.then(() => open(item)), Promise.resolve());
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

/** Let the user pick a local log file to open */
export function chooseLog(): void {
	// The desktop app's menu can't open the web file picker, since it only opens during a click or key press in the page
	if (STUDIO_DESKTOP) {
		void chooseLogWithDialog();
		return;
	}
	if (supportsFileHandles) {
		void chooseLogWithPicker();
		return;
	}

	const input = document.createElement('input');
	input.type = 'file';
	input.accept = logExtensions.join(',');
	input.multiple = true;
	input.addEventListener('change', () => {
		void openInOrder([...(input.files ?? [])], (file) => openLog(file));
	});
	input.click();
}

/** The first dragged file's MIME type. File names aren't available until drop. */
export function draggedFileType(transfer: DataTransfer | null): string | undefined {
	if (!transfer || !transfer.types.includes('Files')) {
		return undefined;
	}
	const type = Array.from(transfer.items).find((item) => item.kind === 'file')?.type;
	return type === 'application/octet-stream' ? '' : (type ?? '');
}

type OpenedLogTarget = { type: 'path'; value: string } | { type: 'url'; value: string };

/** Open the last log the OS, CLI, or `doglog://open?url=...` link asked the desktop app to open */
async function openTakenLog(): Promise<void> {
	const target = await invoke<OpenedLogTarget | null>('take_opened_log');
	if (target === null) {
		return;
	}
	if (target.type === 'url') {
		await openLogUrl(target.value);
	} else {
		await openLogPath(target.value);
	}
}

/** Open a log from the desktop app's file system, and add it to the recent logs. Returns whether it started loading. */
export async function openLogPath(path: string, onError?: (message: string) => void): Promise<boolean> {
	const fileName = path.split(/[/\\]/u).at(-1)!;
	let contents: ArrayBuffer;
	try {
		contents = await invoke<ArrayBuffer>('read_log', { path });
	} catch (error) {
		// Ex. a recent log that was moved or deleted
		removeRecentLog(path);
		toastManager.add({ type: 'error', title: `Couldn't open ${fileName}`, description: String(error) });
		onError?.(String(error));
		return false;
	}
	const opened = await openLog({ name: fileName, contents }, onError);
	if (opened) {
		addRecentLog(path);
	}
	return opened;
}

/** Open logs from the desktop app's file system in order, see `openLogPath()` */
function openLogPaths(paths: readonly string[]): Promise<void> {
	return openInOrder(paths, (path) => openLogPath(path));
}

/** Open WPILOG files the OS asks the desktop app to open, ex. when one is double-clicked */
export async function handleOpenedLogFiles(): Promise<void> {
	await listen('log-opened', () => void openTakenLog());
	// Logs opened before the listener was added, ex. the one that launched the app
	await openTakenLog();
}

/** Whether a file's name or path is a log's */
export function isLogFile(name: string): boolean {
	return logFileExtension.test(name);
}

/** Open logs dropped on the desktop app's window, unless a widget takes them */
export function handleDroppedLogPaths(): Promise<void> {
	return handleFileDrops((paths) => void openLogPaths(paths.filter((path) => isLogFile(path))));
}

/** Open dropped logs unless a widget has already handled the drop */
export function handleLogFileDrop(event: DragEvent): void {
	const transfer = event.dataTransfer;
	if (event.defaultPrevented || transfer?.types.includes('Files') !== true) {
		return;
	}
	// Don't let the browser navigate to unhandled files.
	event.preventDefault();
	// Files and their handles have to be read before the event ends
	const dropped = Array.from(transfer.items).flatMap((item) => {
		const file = item.kind === 'file' ? item.getAsFile() : null;
		return file && isLogFile(file.name)
			? [{ file, handle: supportsFileHandles ? item.getAsFileSystemHandle?.() : undefined }]
			: [];
	});
	void openInOrder(dropped, ({ file, handle }) => openDroppedLog(file, handle));
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

/** Open logs the OS asks the installed web app to open, see `file_handlers` in the web app manifest */
export function handleLaunchedLogFiles(): void {
	window.launchQueue?.setConsumer(({ files }) => {
		const handles = files.filter((handle) => handle instanceof FileSystemFileHandle);
		void openInOrder(handles, openLogHandle);
	});
}
