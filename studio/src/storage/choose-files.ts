import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { stat } from '@tauri-apps/plugin-fs';

/** A file the user chose to upload, with its path in the desktop app or the file itself in the web app */
export type ChosenFile = {
	name: string;
	size: number;
	/** When the file was last changed, which for a video is about when it stopped recording */
	modified: number;
} & ({ localPath: string } | { file: File });

const nameOf = (path: string) => path.split(/[/\\]/u).at(-1)!;

/** Files from paths the desktop app was given, ex. by a drop */
export function filesFromPaths(paths: readonly string[]): Promise<ChosenFile[]> {
	return Promise.all(
		paths.map(async (localPath) => {
			const { size, mtime } = await stat(localPath);
			return { name: nameOf(localPath), size, modified: mtime?.getTime() ?? Date.now(), localPath };
		}),
	);
}

/** Let the user choose files to upload. Call this during a click, since browsers only open the picker then. */
export async function chooseFiles(): Promise<ChosenFile[]> {
	if (STUDIO_DESKTOP) {
		const picked = await openDialog({ multiple: true });
		return picked === null ? [] : filesFromPaths(picked);
	}
	return new Promise((resolve) => {
		const input = document.createElement('input');
		input.type = 'file';
		input.multiple = true;
		input.addEventListener('change', () =>
			resolve(
				[...(input.files ?? [])].map((file) => ({
					name: file.name,
					size: file.size,
					modified: file.lastModified,
					file,
				})),
			),
		);
		input.addEventListener('cancel', () => resolve([]));
		input.click();
	});
}
