import { isTauri } from '@tauri-apps/api/core';
import { Menu } from '@tauri-apps/api/menu';
import { detectPlatform, type Hotkey, useHotkeys } from '@tanstack/react-hotkeys';
import { type RegisteredRouter, useRouter } from '@tanstack/react-router';
import { closeFocusedPane, createDashboard } from '@/dashboards';
import { quickConnect } from '@/data/source';
import { getRobotHost } from '@/robot-target';
import { settingsStore } from '@/settings';

const desktop = isTauri();
/** macOS already uses ⌘W for its default Close Window menu item, so the desktop-only shortcuts are menu items there */
const nativeMenu = desktop && detectPlatform() === 'mac';

/** Options for shortcuts that the native menu handles on macOS */
const desktopOnly = { enabled: desktop && !nativeMenu };

/** Browsers reserve the ⌘ versions of these, so the web app only has the Alt versions */
export const shortcuts = {
	newDashboard: desktop ? 'Mod+T' : 'Alt+T',
	close: desktop ? 'Mod+W' : 'Alt+W',
	settings: desktop ? 'Mod+,' : 'Alt+,',
	quickConnect: 'Mod+K',
} as const satisfies Record<string, Hotkey>;

export function newDashboard(router: RegisteredRouter, position?: 'top' | 'bottom'): void {
	const { id } = createDashboard(position);
	void router.navigate({ to: '/dashboards/$dashboardId', params: { dashboardId: id } });
}

function closeFocused(router: RegisteredRouter): void {
	for (const match of router.state.matches) {
		if (match.routeId === '/dashboards/$dashboardId') {
			closeFocusedPane(match.params.dashboardId);
		}
	}
}

function openSettings(router: RegisteredRouter): void {
	void router.navigate({ to: '/settings' });
}

/** Start quick connect with the robot target from Settings */
export function startQuickConnect(): void {
	quickConnect(getRobotHost(settingsStore.get().robotTarget));
}

/** Register the app-wide keyboard shortcuts */
export function useGlobalShortcuts(): void {
	const router = useRouter();

	useHotkeys(
		[
			{ hotkey: 'Alt+T', callback: () => newDashboard(router) },
			{ hotkey: 'Alt+W', callback: () => closeFocused(router) },
			{ hotkey: 'Alt+,', callback: () => openSettings(router) },
			{ hotkey: 'Mod+T', callback: () => newDashboard(router), options: desktopOnly },
			{ hotkey: 'Mod+W', callback: () => closeFocused(router), options: desktopOnly },
			{ hotkey: 'Mod+,', callback: () => openSettings(router), options: desktopOnly },
			{ hotkey: shortcuts.quickConnect, callback: startQuickConnect },
		],
		{ requireReset: true },
	);
}

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
					{ item: { About: null } },
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
					{ text: 'New Dashboard', accelerator: 'CmdOrCtrl+T', action: () => newDashboard(router) },
					separator,
					{ text: 'Close Pane', accelerator: 'CmdOrCtrl+W', action: () => closeFocused(router) },
				],
			},
			{
				text: 'Edit',
				items: [
					{ item: 'Undo' },
					{ item: 'Redo' },
					separator,
					{ item: 'Cut' },
					{ item: 'Copy' },
					{ item: 'Paste' },
					{ item: 'SelectAll' },
				],
			},
			{ text: 'View', items: [{ item: 'Fullscreen' }] },
			// Leaves out Close Window, which also uses ⌘W
			{ text: 'Window', items: [{ item: 'Minimize' }, { item: 'Maximize' }, separator, { item: 'BringAllToFront' }] },
		],
	});
	await menu.setAsAppMenu();
}
