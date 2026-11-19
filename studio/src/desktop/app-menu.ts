import type { RegisteredRouter } from '@tanstack/react-router';
import { Menu } from '@tauri-apps/api/menu';
import {
	closeCurrentDashboard,
	closeFocused,
	nativeMenu,
	newDashboard,
	newWindow,
	openSettings,
	reopenDashboard,
	undoOrRedo,
} from '@/commands/commands';
import { goInHistory } from '@/commands/history';
import { chooseLog } from '@/data/open-log';
import { createOpenRecentMenu } from '@/desktop/native-menu';
import { checkForUpdateManually } from '@/updater';

/** Replace the default macOS app menu with one whose shortcuts run Studio's commands */
export async function setUpAppMenu(router: RegisteredRouter): Promise<void> {
	if (!nativeMenu) {
		return;
	}

	const separator = { item: 'Separator' } as const;
	const menu = await Menu.new({
		items: [
			{
				text: 'DogLog Studio',
				items: [
					{
						item: {
							About: {
								version: STUDIO_VERSION,
								// Shown in parentheses after the version
								...(STUDIO_COMMIT !== null && { shortVersion: STUDIO_COMMIT }),
								// The copyright comes from `bundle.copyright` in `tauri.conf.json`
								credits: 'Review FRC robot logs and debug robots live',
							},
						},
					},
					{ text: 'Check for Updates…', action: () => void checkForUpdateManually() },
					separator,
					{ text: 'Settings…', accelerator: 'CmdOrCtrl+,', action: () => openSettings(router) },
					separator,
					{ item: 'Services' },
					separator,
					{ item: 'Hide' },
					{ item: 'HideOthers' },
					{ item: 'ShowAll' },
					separator,
					{ item: 'Quit' },
				],
			},
			{
				text: 'File',
				items: [
					{ text: 'New Window', accelerator: 'CmdOrCtrl+N', action: newWindow },
					{ text: 'New Dashboard', accelerator: 'CmdOrCtrl+T', action: () => newDashboard(router) },
					{
						text: 'Reopen Closed Dashboard',
						accelerator: 'CmdOrCtrl+Shift+T',
						action: () => reopenDashboard(router),
					},
					{ text: 'Open Log…', accelerator: 'CmdOrCtrl+O', action: chooseLog },
					await createOpenRecentMenu(),
					separator,
					{ text: 'Close Pane', accelerator: 'CmdOrCtrl+W', action: () => closeFocused(router) },
					{
						text: 'Close Dashboard',
						accelerator: 'CmdOrCtrl+Shift+W',
						action: () => closeCurrentDashboard(router),
					},
				],
			},
			{
				text: 'Edit',
				items: [
					{ text: 'Undo', accelerator: 'CmdOrCtrl+Z', action: () => undoOrRedo(router, 'undo') },
					{ text: 'Redo', accelerator: 'CmdOrCtrl+Shift+Z', action: () => undoOrRedo(router, 'redo') },
					separator,
					{ item: 'Cut' },
					{ item: 'Copy' },
					{ item: 'Paste' },
					{ item: 'SelectAll' },
				],
			},
			{ text: 'View', items: [{ item: 'Fullscreen' }] },
			{
				text: 'Go',
				items: [
					{ text: 'Back', accelerator: 'CmdOrCtrl+[', action: () => goInHistory(router, -1) },
					{ text: 'Forward', accelerator: 'CmdOrCtrl+]', action: () => goInHistory(router, 1) },
				],
			},
			// Leaves out Close Window, which also uses ⌘W
			{ text: 'Window', items: [{ item: 'Minimize' }, { item: 'Maximize' }, separator, { item: 'BringAllToFront' }] },
		],
	});
	await menu.setAsAppMenu();
}
