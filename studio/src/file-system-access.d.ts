// The Chromium-only parts of the File System Access API and file handling, which TypeScript's DOM types leave out

interface FileSystemHandle {
	requestPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
	queryPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
}

interface DataTransferItem {
	getAsFileSystemHandle?(): Promise<FileSystemHandle | null>;
}

interface OpenFilePickerOptions {
	multiple?: boolean;
	types?: { description?: string; accept: Record<string, string[]> }[];
}

interface LaunchParams {
	readonly files: readonly FileSystemHandle[];
}

// Only in dedicated workers, which TypeScript's DOM types leave out
interface FileSystemSyncAccessHandle {
	close(): void;
	flush(): void;
	getSize(): number;
	read(buffer: ArrayBufferView, options?: { at?: number }): number;
	truncate(newSize: number): void;
	write(buffer: ArrayBufferView, options?: { at?: number }): number;
}

interface FileSystemDirectoryHandle {
	values(): AsyncIterableIterator<FileSystemDirectoryHandle | FileSystemFileHandle>;
}

interface FileSystemFileHandle {
	createSyncAccessHandle(): Promise<FileSystemSyncAccessHandle>;
}

interface Window {
	showOpenFilePicker?(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>;
	showDirectoryPicker?(options?: { mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>;
	launchQueue?: { setConsumer(consumer: (params: LaunchParams) => void): void };
}
