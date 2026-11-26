import type { RegisteredRouter } from '@tanstack/react-router';
import { Menu, MenuItem, type MenuItemOptions, Submenu } from '@tauri-apps/api/menu';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
	closeCurrentDashboard,
	closeFocused,
	nativeMenu,
	newDashboard,
	newWindow,
	openLogs,
	openLogUrlPrompt,
	openSettings,
	reopenDashboard,
	startConnect,
	canUndoOrRedo,
	undoOrRedo,
} from '@/commands/commands';
import {
	canCopyCurrentDashboard,
	canEditFocusedEntries,
	canExportCurrentDashboardVideo,
	canSplitFocused,
	canToggleEntryBrowser,
	canZoomFocused,
	copyCurrentDashboardImage,
	copyCurrentDashboardLink,
	currentDashboard,
	exportCurrentDashboardVideo,
	splitFocused,
	toggleDashboardEntryBrowser,
	toggleFocusedEditing,
	toggleFocusedZoom,
} from '@/commands/dashboard-commands';
import { canGoInHistory, goInHistory } from '@/commands/history';
import { toggleKeyboardShortcutsDialog } from '@/commands/keyboard-shortcuts-dialog-handle';
import { aboutDialogOpen } from '@/components/about-dialog-handle';
import { canExportLive, exportLive } from '@/data/export-live';
import { chooseLog } from '@/data/open-log';
import { closedStore, subscribeDashboards } from '@/dashboards/dashboards';
import { subscribeData } from '@/data/data-store';
import { subscribeSource } from '@/data/source';
import { canCapture } from '@/desktop/capture';
import { createOpenRecentMenu } from '@/desktop/native-menu';
import { isExportingVideo, subscribeVideoExport } from '@/desktop/video-export';
import { requestSidebarToggle } from '@/sidebar/sidebar';
import { checkOrInstallUpdate, updateTitle, watchUpdate } from '@/updater';

/** Replace the default macOS app menu with one whose shortcuts run Studio's commands */
export async function setUpAppMenu(router: RegisteredRouter): Promise<void> {
	if (!nativeMenu) {
		return;
	}

	const separator = { item: 'Separator' } as const;
	/** Items that are disabled while their command can't run */
	const conditionalItems: { item: MenuItem; canRun: () => boolean; enabled: boolean }[] = [];
	const conditional = async (options: MenuItemOptions, canRun: () => boolean) => {
		const enabled = canRun();
		const item = await MenuItem.new({ ...options, enabled });
		conditionalItems.push({ item, canRun, enabled });
		return item;
	};
	// Live data can change this every frame, so only changes go to the native menu
	const updateEnabled = () => {
		for (const conditionalItem of conditionalItems) {
			const enabled = conditionalItem.canRun();
			if (enabled !== conditionalItem.enabled) {
				conditionalItem.enabled = enabled;
				void conditionalItem.item.setEnabled(enabled);
			}
		}
	};
	// Like the update shortcut, it installs the update once one is found
	const updateItem = await MenuItem.new({
		text: 'Check for Updates…',
		accelerator: 'CmdOrCtrl+Shift+U',
		action: () => void checkOrInstallUpdate(),
	});
	watchUpdate((state) => {
		void updateItem.setText(
			state?.installing === true ? 'Updating…' : state ? `${updateTitle(state.update)}…` : 'Check for Updates…',
		);
		void updateItem.setEnabled(state?.installing !== true);
	});
	const helpMenu = await Submenu.new({
		text: 'Help',
		items: [{ text: 'Keyboard Shortcuts', accelerator: 'CmdOrCtrl+/', action: toggleKeyboardShortcutsDialog }],
	});
	const menu = await Menu.new({
		items: [
			{
				text: 'DogLog Studio',
				items: [
					{ text: 'About DogLog Studio', action: () => aboutDialogOpen.set(true) },
					updateItem,
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
					await conditional(
						{
							text: 'Reopen Closed Dashboard',
							accelerator: 'CmdOrCtrl+Shift+T',
							action: () => reopenDashboard(router),
						},
						() => closedStore.get().length > 0,
					),
					{ text: 'Open Log…', accelerator: 'CmdOrCtrl+O', action: chooseLog },
					{ text: 'Open from URL…', accelerator: 'CmdOrCtrl+Shift+O', action: openLogUrlPrompt },
					await createOpenRecentMenu(),
					{ text: 'Connect', accelerator: 'CmdOrCtrl+K', action: startConnect },
					separator,
					await conditional(
						{ text: 'Export Live Data as WPILOG…', accelerator: 'CmdOrCtrl+S', action: () => void exportLive() },
						canExportLive,
					),
					...(canCapture
						? [
								await conditional(
									{
										text: 'Export Dashboard Video…',
										accelerator: 'CmdOrCtrl+R',
										action: () => exportCurrentDashboardVideo(router),
									},
									() => canExportCurrentDashboardVideo(router),
								),
							]
						: []),
					separator,
					// Closes the window when there's no dashboard
					await conditional(
						{ text: 'Close Pane', accelerator: 'CmdOrCtrl+W', action: () => closeFocused(router) },
						() => !isExportingVideo(),
					),
					await conditional(
						{ text: 'Close Dashboard', accelerator: 'CmdOrCtrl+Shift+W', action: () => closeCurrentDashboard(router) },
						() => currentDashboard(router) !== undefined,
					),
				],
			},
			{
				text: 'Edit',
				items: [
					await conditional(
						{ text: 'Undo', accelerator: 'CmdOrCtrl+Z', action: () => undoOrRedo(router, 'undo') },
						() => canUndoOrRedo(router, 'undo'),
					),
					await conditional(
						{ text: 'Redo', accelerator: 'CmdOrCtrl+Shift+Z', action: () => undoOrRedo(router, 'redo') },
						() => canUndoOrRedo(router, 'redo'),
					),
					separator,
					{ item: 'Cut' },
					{ item: 'Copy' },
					{ item: 'Paste' },
					{ item: 'SelectAll' },
					separator,
					await conditional(
						{
							text: 'Copy Dashboard Link',
							accelerator: 'CmdOrCtrl+Shift+C',
							action: () => {
								copyCurrentDashboardLink(router);
							},
						},
						() => canCopyCurrentDashboard(router),
					),
					// ⌘C stays with Copy, which falls back to copying the dashboard's image
					...(canCapture
						? [
								await conditional(
									{ text: 'Copy Dashboard Image', action: () => copyCurrentDashboardImage(router) },
									() => canCopyCurrentDashboard(router),
								),
							]
						: []),
				],
			},
			{
				text: 'View',
				items: [
					{ text: 'Toggle Sidebar', accelerator: 'CmdOrCtrl+B', action: requestSidebarToggle },
					await conditional(
						{
							text: 'Toggle Entry Browser',
							accelerator: 'CmdOrCtrl+Alt+B',
							action: () => toggleDashboardEntryBrowser(router),
						},
						() => canToggleEntryBrowser(router),
					),
					separator,
					await conditional(
						{ text: 'Split Right', accelerator: 'CmdOrCtrl+D', action: () => splitFocused(router, 'row') },
						() => canSplitFocused(router, 'row'),
					),
					await conditional(
						{ text: 'Split Down', accelerator: 'CmdOrCtrl+Shift+D', action: () => splitFocused(router, 'column') },
						() => canSplitFocused(router, 'column'),
					),
					await conditional(
						{
							text: 'Zoom or Restore Pane',
							accelerator: 'CmdOrCtrl+Shift+Enter',
							action: () => toggleFocusedZoom(router),
						},
						() => canZoomFocused(router),
					),
					await conditional(
						{ text: 'Edit Entries', accelerator: 'CmdOrCtrl+E', action: () => toggleFocusedEditing(router) },
						() => canEditFocusedEntries(router),
					),
					separator,
					{ item: 'Fullscreen' },
				],
			},
			{
				text: 'Go',
				items: [
					await conditional({ text: 'Back', accelerator: 'CmdOrCtrl+[', action: () => goInHistory(router, -1) }, () =>
						canGoInHistory(-1),
					),
					await conditional({ text: 'Forward', accelerator: 'CmdOrCtrl+]', action: () => goInHistory(router, 1) }, () =>
						canGoInHistory(1),
					),
					separator,
					{ text: 'Logs', accelerator: 'CmdOrCtrl+L', action: () => openLogs(router) },
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
