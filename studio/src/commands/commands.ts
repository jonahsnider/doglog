import { isTauri } from '@tauri-apps/api/core';
import {
	detectPlatform,
	getKeyStateTracker,
	type Hotkey,
	matchesHeldModifiers,
	useHotkeys,
} from '@tanstack/react-hotkeys';
import { type RegisteredRouter, useRouter } from '@tanstack/react-router';
import { useSelector } from '@tanstack/react-store';
import { useDebounceValue } from 'usehooks-ts';
import { closeFocusedPane, getFocusedPane, splitDashboardPane, toggleZoom } from '@/dashboards/panes';
import {
	createDashboard,
	type Dashboard,
	deleteDashboard,
	getDashboard,
	getDashboards,
	redoDashboard,
	reopenClosedDashboards,
	undoDashboard,
} from '@/dashboards/dashboards';
import { goInHistory } from '@/commands/history';
import { chooseLog } from '@/data/open-log';
import { checkOrInstallUpdate, updateShortcut } from '@/desktop/updater';
import { connect } from '@/data/source';
import { canSplitPane, type SplitDirection } from '@/panes/layout';
import { getRobotHost } from '@/robot-target';
import { settingsStore } from '@/settings';

const desktop = isTauri();
/** macOS already uses ⌘W for its default Close Window menu item, so the desktop-only shortcuts are menu items there */
export const nativeMenu = desktop && detectPlatform() === 'mac';

/** Options for shortcuts that the native menu handles on macOS */
const desktopOnly = { enabled: desktop && !nativeMenu };
/** Options for shortcuts that the native menu handles on macOS, and that also work on the web */
const outsideNativeMenu = { enabled: !nativeMenu };

/** Browsers reserve the ⌘ versions of these, so the web app only has the Alt versions */
export const shortcuts = {
	newDashboard: desktop ? 'Mod+T' : 'Alt+T',
	close: desktop ? 'Mod+W' : 'Alt+W',
	closeDashboard: desktop ? 'Mod+Shift+W' : 'Alt+Shift+W',
	reopenDashboard: desktop ? 'Mod+Shift+T' : 'Alt+Shift+T',
	settings: desktop ? 'Mod+,' : 'Alt+,',
	logs: desktop ? 'Mod+L' : 'Alt+L',
	back: desktop ? 'Mod+[' : 'Alt+[',
	forward: desktop ? 'Mod+]' : 'Alt+]',
	connect: 'Mod+K',
	splitRight: 'Mod+D',
	splitDown: 'Mod+Shift+D',
	zoom: 'Mod+Shift+Enter',
	openLog: 'Mod+O',
	undo: 'Mod+Z',
	redo: 'Mod+Shift+Z',
	toggleSidebar: 'Mod+B',
	toggleEntryBrowser: 'Mod+Alt+B',
	keyboardShortcuts: 'Mod+/',
	searchEntries: '/',
	update: updateShortcut,
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

/** Whether the user is holding `shortcut`'s modifiers, so the sidebar can show it */
export function useShortcutHint(shortcut: Hotkey | undefined): boolean {
	// Unlike `useHotkeyHint`, this includes shortcuts that the native menu handles
	const held = useSelector(getKeyStateTracker().store, (state) => matchesHeldModifiers(shortcut, state.heldKeys));
	// Waits a moment so quickly pressing a shortcut doesn't flash the hints
	const [delayed] = useDebounceValue(held, 300);
	return held && delayed;
}

export function newDashboard(router: RegisteredRouter, position?: 'top' | 'bottom'): void {
	const opener = { pathname: router.state.location.pathname, dashboardId: currentDashboard(router)?.id };
	const { id } = createDashboard(position);
	void router.navigate({ to: '/dashboards/$dashboardId', params: { dashboardId: id }, state: { opener } });
}

function currentDashboard(router: RegisteredRouter): Dashboard | undefined {
	const match = router.state.matches.find((other) => other.routeId === '/dashboards/$dashboardId');
	return match && getDashboard(match.params.dashboardId);
}

export function closeFocused(router: RegisteredRouter): void {
	const dashboard = currentDashboard(router);
	if (dashboard) {
		closeFocusedPane(dashboard.id);
	}
}

export function closeCurrentDashboard(router: RegisteredRouter): void {
	const dashboard = currentDashboard(router);
	if (dashboard) {
		deleteDashboard(dashboard.id);
	}
}

export function reopenDashboard(router: RegisteredRouter): void {
	const dashboard = reopenClosedDashboards();
	if (dashboard) {
		void router.navigate({ to: '/dashboards/$dashboardId', params: { dashboardId: dashboard.id } });
	}
}

/** Text fields keep their own undo history */
function isEditingText(): boolean {
	const element = document.activeElement;
	return (
		element instanceof HTMLInputElement ||
		element instanceof HTMLTextAreaElement ||
		(element instanceof HTMLElement && element.isContentEditable)
	);
}

export function undoOrRedo(router: RegisteredRouter, direction: 'undo' | 'redo'): void {
	if (isEditingText()) {
		// The native menu's Undo and Redo replace the predefined items that would do this for text fields
		// oxlint-disable-next-line typescript/no-deprecated -- It's the only way to trigger a text field's undo
		document.execCommand(direction);
		return;
	}

	const dashboard = currentDashboard(router);
	if (dashboard) {
		(direction === 'undo' ? undoDashboard : redoDashboard)(dashboard.id);
	}
}

function toggleFocusedZoom(router: RegisteredRouter): void {
	const dashboard = currentDashboard(router);
	if (dashboard) {
		toggleZoom(dashboard.id, getFocusedPane(dashboard).id);
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

export function openSettings(router: RegisteredRouter): void {
	void router.navigate({ to: '/settings' });
}

function openLogs(router: RegisteredRouter): void {
	void router.navigate({ to: '/logs' });
}

/** Connect to the robot target from Settings, or the simulator */
export function startConnect(): void {
	void connect(getRobotHost(settingsStore.get().robotTarget));
}

/** Register the app-wide keyboard shortcuts */
export function useGlobalShortcuts(): void {
	const router = useRouter();

	useHotkeys(
		[
			{ hotkey: 'Alt+T', callback: () => newDashboard(router) },
			{ hotkey: 'Alt+W', callback: () => closeFocused(router) },
			{ hotkey: 'Alt+Shift+W', callback: () => closeCurrentDashboard(router) },
			{ hotkey: 'Alt+Shift+T', callback: () => reopenDashboard(router) },
			{ hotkey: 'Alt+,', callback: () => openSettings(router) },
			{ hotkey: 'Alt+L', callback: () => openLogs(router) },
			{ hotkey: 'Alt+[', callback: () => goInHistory(router, -1) },
			{ hotkey: 'Alt+]', callback: () => goInHistory(router, 1) },
			{ hotkey: 'Mod+T', callback: () => newDashboard(router), options: desktopOnly },
			{ hotkey: 'Mod+W', callback: () => closeFocused(router), options: desktopOnly },
			{ hotkey: 'Mod+Shift+W', callback: () => closeCurrentDashboard(router), options: desktopOnly },
			{ hotkey: 'Mod+Shift+T', callback: () => reopenDashboard(router), options: desktopOnly },
			{ hotkey: 'Mod+,', callback: () => openSettings(router), options: desktopOnly },
			{ hotkey: 'Mod+L', callback: () => openLogs(router), options: { enabled: desktop } },
			{ hotkey: shortcuts.update, callback: () => void checkOrInstallUpdate(), options: { enabled: desktop } },
			{ hotkey: 'Mod+[', callback: () => goInHistory(router, -1), options: desktopOnly },
			{ hotkey: 'Mod+]', callback: () => goInHistory(router, 1), options: desktopOnly },
			{ hotkey: shortcuts.connect, callback: startConnect },
			{ hotkey: shortcuts.splitRight, callback: () => splitFocused(router, 'row') },
			{ hotkey: shortcuts.splitDown, callback: () => splitFocused(router, 'column') },
			{ hotkey: shortcuts.zoom, callback: () => toggleFocusedZoom(router) },
			{ hotkey: shortcuts.openLog, callback: chooseLog, options: outsideNativeMenu },
			// Text fields handle these themselves
			{
				hotkey: shortcuts.undo,
				callback: () => undoOrRedo(router, 'undo'),
				options: { ...outsideNativeMenu, ignoreInputs: true },
			},
			{
				hotkey: shortcuts.redo,
				callback: () => undoOrRedo(router, 'redo'),
				options: { ...outsideNativeMenu, ignoreInputs: true },
			},
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
