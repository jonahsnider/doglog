// The Chromium-only parts of the File System Access API and file handling, which TypeScript's DOM types leave out

interface FileSystemHandle {
	requestPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
	queryPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
}

interface DataTransferItem {
	getAsFileSystemHandle?(): Promise<FileSystemHandle | null>;
}

interface OpenFilePickerOptions {
	types?: { description?: string; accept: Record<string, string[]> }[];
}

interface LaunchParams {
	readonly files: readonly FileSystemHandle[];
}

interface Window {
	showOpenFilePicker?(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>;
	showDirectoryPicker?(options?: { mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>;
	launchQueue?: { setConsumer(consumer: (params: LaunchParams) => void): void };
}
