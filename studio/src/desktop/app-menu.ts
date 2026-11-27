import type { RegisteredRouter } from '@tanstack/react-router';
import { Menu, MenuItem, type MenuItemOptions, Submenu } from '@tauri-apps/api/menu';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { type AppCommand, canRunCommand, commands } from '@/commands/app-commands';
import { nativeMenu } from '@/commands/commands';
import { aboutDialogOpen } from '@/components/about-dialog-handle';
import { closedStore, subscribeDashboards } from '@/dashboards/dashboards';
import { subscribeData } from '@/data/data-store';
import { subscribeSource } from '@/data/source';
import { createOpenRecentMenu } from '@/desktop/native-menu';
import { subscribeVideoExport } from '@/desktop/video-export';
import { updateTitle, watchUpdate } from '@/updater';

/** Short words macOS leaves lowercase in title case */
const minorWords = new Set([
	'a',
	'an',
	'and',
	'as',
	'at',
	'by',
	'for',
	'from',
	'in',
	'of',
	'on',
	'or',
	'the',
	'to',
	'with',
]);

/**
 * A command's label in title case for the menu bar, with `…` when it asks for more before acting, ex.
 * `Export Live Data as WPILOG…` from `Export live data as WPILOG`
 */
function menuLabel(command: AppCommand): string {
	const title = command.label
		.split(' ')
		.map((word, index) => (index > 0 && minorWords.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
		.join(' ');
	return command.ellipsis ? `${title}…` : title;
}

/** Replace the default macOS app menu with one whose shortcuts run Studio's commands */
export async function setUpAppMenu(router: RegisteredRouter): Promise<void> {
	if (!nativeMenu) {
		return;
	}

	const separator = { item: 'Separator' } as const;
	/** Items that are disabled while their command can't run */
	const conditionalItems: { item: MenuItem; command: AppCommand; enabled: boolean }[] = [];
	const commandOptions = (command: AppCommand): MenuItemOptions => ({
		text: menuLabel(command),
		action: () => command.run(router),
		...(command.shortcut === undefined || command.ownHotkey
			? {}
			: { accelerator: String(command.shortcut).replace('Mod', 'CmdOrCtrl') }),
	});
	const commandItem = async (command: AppCommand): Promise<MenuItem | MenuItemOptions> => {
		if (!command.canRun) {
			return commandOptions(command);
		}
		const enabled = canRunCommand(router, command);
		const item = await MenuItem.new({ ...commandOptions(command), enabled });
		conditionalItems.push({ item, command, enabled });
		return item;
	};
	// Live data can change this every frame, so only changes go to the native menu
	const updateEnabled = () => {
		for (const conditionalItem of conditionalItems) {
			const enabled = canRunCommand(router, conditionalItem.command);
			if (enabled !== conditionalItem.enabled) {
				conditionalItem.enabled = enabled;
				void conditionalItem.item.setEnabled(enabled);
			}
		}
	};
	// Shows when an update is found, which its command then installs
	const updateItem = await MenuItem.new(commandOptions(commands.update));
	watchUpdate((state) => {
		void updateItem.setText(
			state?.installing === true ? 'Updating…' : state ? `${updateTitle(state.update)}…` : menuLabel(commands.update),
		);
		void updateItem.setEnabled(state?.installing !== true);
	});
	const helpMenu = await Submenu.new({ text: 'Help', items: [await commandItem(commands.keyboardShortcuts)] });
	const menu = await Menu.new({
		items: [
			{
				text: 'DogLog Studio',
				items: [
					{ text: 'About DogLog Studio', action: () => aboutDialogOpen.set(true) },
					updateItem,
					separator,
					await commandItem(commands.settings),
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
					await commandItem(commands.newWindow),
					await commandItem(commands.newDashboard),
					await commandItem(commands.reopenDashboard),
					await commandItem(commands.openLog),
					await commandItem(commands.openLogUrl),
					await createOpenRecentMenu(),
					await commandItem(commands.connect),
					separator,
					await commandItem(commands.exportLive),
					...(commands.exportVideo.available ? [await commandItem(commands.exportVideo)] : []),
					separator,
					// Closes the window when there's no dashboard
					await commandItem(commands.close),
					await commandItem(commands.closeDashboard),
				],
			},
			{
				text: 'Edit',
				items: [
					await commandItem(commands.undo),
					await commandItem(commands.redo),
					separator,
					{ item: 'Cut' },
					{ item: 'Copy' },
					{ item: 'Paste' },
					{ item: 'SelectAll' },
					separator,
					await commandItem(commands.copyDashboardLink),
					...(commands.copyDashboardImage.available ? [await commandItem(commands.copyDashboardImage)] : []),
				],
			},
			{
				text: 'View',
				items: [
					await commandItem(commands.commandPalette),
					separator,
					await commandItem(commands.toggleSidebar),
					await commandItem(commands.toggleEntryBrowser),
					separator,
					await commandItem(commands.splitRight),
					await commandItem(commands.splitDown),
					await commandItem(commands.splitBestFit),
					await commandItem(commands.balanceSplits),
					await commandItem(commands.zoom),
					await commandItem(commands.editEntries),
					separator,
					{ item: 'Fullscreen' },
				],
			},
			{
				text: 'Go',
				items: [
					await commandItem(commands.back),
					await commandItem(commands.forward),
					separator,
					await commandItem(commands.logs),
				],
			},
			// Leaves out Close Window, which also uses ⌘W
			{ text: 'Window', items: [{ item: 'Minimize' }, { item: 'Maximize' }, separator, { item: 'BringAllToFront' }] },
			helpMenu,
		],
	});
	router.subscribe('onResolved', updateEnabled);
	subscribeDashboards(updateEnabled);
	closedStore.subscribe(updateEnabled);
	subscribeSource(updateEnabled);
	subscribeData(updateEnabled);
	subscribeVideoExport(updateEnabled);
	// Undo and Redo follow whether a text field is focused
	document.addEventListener('focusin', updateEnabled);
	document.addEventListener('focusout', () => queueMicrotask(updateEnabled));
	await menu.setAsAppMenu();
	// Adds macOS's menu search field
	await helpMenu.setAsHelpMenuForNSApp();
	// Every window shares the app menu, so the focused one sets its own for the commands to run in it
	await getCurrentWindow().onFocusChanged(({ payload: focused }) => {
		if (focused) {
			void menu.setAsAppMenu();
		}
	});
}
