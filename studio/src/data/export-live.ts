import { detectPlatform, type Hotkey } from '@tanstack/react-hotkeys';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { toastManager } from '@/components/toast';
import { getLiveRecording } from '@/data/recording';

/** Exports like saving in other apps, on the web too since saving the page isn't useful */
export const exportLiveShortcut = 'Mod+S' satisfies Hotkey;

/** Whether the live session has data to export, it has none until it first connects */
export function canExportLive(): boolean {
	return getLiveRecording()?.started === true;
}

/** The live session's recording, and a file name for it from when the session started like WPILib's */
async function readLiveRecording(): Promise<{ file: Blob; name: string }> {
	const recording = getLiveRecording();
	if (recording?.startedAt === undefined) {
		throw new Error("There's no live data to export.");
	}
	// In UTC, which Studio reads WPILib's names as
	const [day, time] = new Date(recording.startedAt / 1000)
		.toISOString()
		.slice(0, 19)
		.replaceAll('-', '')
		.replaceAll(':', '')
		.split('T');
	return { file: await recording.read(), name: `WPILIB_${day}_${time}.wpilog` };
}

/** Write `file` to `path`, or a new file in the temporary folder. Desktop only. Returns where it was saved. */
async function saveFile(file: Blob, path: string | undefined): Promise<string> {
	// Headers only take ASCII
	const encodedPath = path === undefined ? undefined : btoa(String.fromCodePoint(...new TextEncoder().encode(path)));
	return invoke<string>('save_live_export', await file.arrayBuffer(), {
		headers: encodedPath === undefined ? {} : { path: encodedPath },
	});
}

/** Save the live session's recording to `path`, or a new file in the temporary folder, for agents. Desktop only. */
export async function saveLiveExport(path: string | undefined): Promise<string> {
	const { file } = await readLiveRecording();
	return saveFile(file, path);
}

/**
 * Let the user save `file`, with a save dialog on desktop or as a download, and say where it was saved on desktop.
 * `filter` is the kind of file it is, for the save dialog.
 */
export async function saveFileAs(
	file: Blob,
	name: string,
	filter: { name: string; extensions: string[] },
	savedTitle: string,
): Promise<void> {
	if (!STUDIO_DESKTOP) {
		const url = URL.createObjectURL(file);
		const link = document.createElement('a');
		link.href = url;
		link.download = name;
		link.click();
		// Once the download started
		setTimeout(() => URL.revokeObjectURL(url), 60_000);
		return;
	}

	const path = await save({ defaultPath: name, filters: [filter] });
	if (path === null) {
		return;
	}
	await saveFile(file, path);
	toastManager.add({
		type: 'success',
		title: savedTitle,
		actionProps: {
			children: detectPlatform() === 'mac' ? 'Show in Finder' : 'Show in File Explorer',
			onClick: () => void revealItemInDir(path),
		},
	});
}

/** Let the user save the live session's recording as a WPILOG file, with a save dialog on desktop or as a download */
export async function exportLive(): Promise<void> {
	// Ex. the shortcut before the session connected
	if (!canExportLive()) {
		return;
	}
	try {
		// Read first, so it has the data from when the user chose to export
		const { file, name } = await readLiveRecording();
		await saveFileAs(file, name, { name: 'WPILOG', extensions: ['wpilog'] }, 'Exported live data');
	} catch (error) {
		toastManager.add({ type: 'error', title: 'Couldn’t export live data', description: String(error) });
	}
}
