import { isTauri } from '@tauri-apps/api/core';
import { Menu } from '@tauri-apps/api/menu';
import { detectPlatform, type Hotkey, useHotkeys } from '@tanstack/react-hotkeys';
import { type RegisteredRouter, useRouter } from '@tanstack/react-router';
import { closeDashboard } from '@/close-dashboard';
import {
	closeFocusedPane,
	createDashboard,
	type Dashboard,
	getDashboard,
	getDashboards,
	getFocusedPane,
	splitDashboardPane,
} from '@/dashboards';
import { chooseLog, connect } from '@/data/source';
import { canSplitPane, type SplitDirection } from '@/pane-layout';
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
	connect: 'Mod+K',
	splitRight: 'Mod+D',
	splitDown: 'Mod+Shift+D',
	openLog: 'Mod+O',
} as const satisfies Record<string, Hotkey>;

const dashboardNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** The shortcut that switches to the dashboard at `index` in the sidebar, if it has one */
export function dashboardShortcut(index: number): Hotkey | undefined {
	const number = dashboardNumbers[index];
	if (number === undefined) {
		return undefined;
	}
	return desktop ? `Mod+${number}` : `Alt+${number}`;
}

export function newDashboard(router: RegisteredRouter, position?: 'top' | 'bottom'): void {
	const { id } = createDashboard(position);
	void router.navigate({ to: '/dashboards/$dashboardId', params: { dashboardId: id } });
}

function currentDashboard(router: RegisteredRouter): Dashboard | undefined {
	const match = router.state.matches.find((other) => other.routeId === '/dashboards/$dashboardId');
	return match && getDashboard(match.params.dashboardId);
}

function closeFocused(router: RegisteredRouter): void {
	const dashboard = currentDashboard(router);
	if (dashboard) {
		closeFocusedPane(dashboard.id);
	}
}

function closeCurrentDashboard(router: RegisteredRouter): void {
	const dashboard = currentDashboard(router);
	if (dashboard) {
		closeDashboard(dashboard);
	}
}

function splitFocused(router: RegisteredRouter, direction: SplitDirection): void {
	const dashboard = currentDashboard(router);
	if (!dashboard) {
		return;
	}

	const pane = getFocusedPane(dashboard);
	if (canSplitPane(dashboard.layout, pane.id, direction)) {
		splitDashboardPane(dashboard.id, pane.id, direction);
	}
}

function openDashboardAt(router: RegisteredRouter, index: number): void {
	const dashboard = getDashboards()[index];
	if (dashboard) {
		void router.navigate({ to: '/dashboards/$dashboardId', params: { dashboardId: dashboard.id } });
	}
}

function openSettings(router: RegisteredRouter): void {
	void router.navigate({ to: '/settings' });
}

/** Connect to the robot target from Settings, or the simulator */
export function startConnect(): void {
	connect(getRobotHost(settingsStore.get().robotTarget));
}

/** Register the app-wide keyboard shortcuts */
export function useGlobalShortcuts(): void {
	const router = useRouter();

	useHotkeys(
		[
			{ hotkey: 'Alt+T', callback: () => newDashboard(router) },
			{ hotkey: 'Alt+W', callback: () => closeFocused(router) },
			{ hotkey: 'Alt+Shift+W', callback: () => closeCurrentDashboard(router) },
			{ hotkey: 'Alt+,', callback: () => openSettings(router) },
			{ hotkey: 'Mod+T', callback: () => newDashboard(router), options: desktopOnly },
			{ hotkey: 'Mod+W', callback: () => closeFocused(router), options: desktopOnly },
			{ hotkey: 'Mod+Shift+W', callback: () => closeCurrentDashboard(router), options: desktopOnly },
			{ hotkey: 'Mod+,', callback: () => openSettings(router), options: desktopOnly },
			{ hotkey: shortcuts.connect, callback: startConnect },
			{ hotkey: shortcuts.splitRight, callback: () => splitFocused(router, 'row') },
			{ hotkey: shortcuts.splitDown, callback: () => splitFocused(router, 'column') },
			{ hotkey: shortcuts.openLog, callback: chooseLog },
			...dashboardNumbers.flatMap((number) => [
				{ hotkey: `Alt+${number}` as const, callback: () => openDashboardAt(router, number - 1) },
				{
					hotkey: `Mod+${number}` as const,
					callback: () => openDashboardAt(router, number - 1),
					options: { enabled: desktop },
				},
			]),
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
