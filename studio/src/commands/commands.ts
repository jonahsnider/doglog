import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { confirm } from '@tauri-apps/plugin-dialog';
import { useHotkeys } from '@tanstack/react-hotkeys';
import { type RegisteredRouter, useRouter } from '@tanstack/react-router';
import { canCopyDashboardLink, copyDashboardLink } from '@/dashboards/copy-dashboard-link';
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
import { openLogUrlDialogOpen } from '@/components/open-log-url-dialog-handle';
import { goInHistory } from '@/commands/history';
import {
	dashboardNumbers,
	dashboardShortcut,
	nativeMenu,
	redoAlternate,
	shortcuts,
	useShortcutHint,
} from '@/commands/shortcuts';
import { isExportingVideo } from '@/desktop/video-export';
import { toggleEditing } from '@/entries/editing';
import { chooseLog } from '@/data/open-log';
import { checkOrInstallUpdate } from '@/updater';
import { connect, getSource, showSource } from '@/data/source';
import type { SplitDirection } from '@/panes/layout';
import { shownTuningDashboard } from '@/tuning/dashboard';
import { getRobotHost } from '@/robot-target';
import { settingsStore } from '@/settings';
import { getWidgetType } from '@/widgets/registry';
import { bindsEntries } from '@/widgets/widget-type';

export { dashboardShortcut, nativeMenu, redoAlternate, shortcuts, useShortcutHint };

const desktop = STUDIO_DESKTOP;

/** Options for shortcuts that the native menu handles on macOS */
const desktopOnly = { enabled: desktop && !nativeMenu };
/** Options for shortcuts that the native menu handles on macOS, and that also work on the web */
const outsideNativeMenu = { enabled: !nativeMenu };

export function newDashboard(router: RegisteredRouter, position?: 'top' | 'bottom'): void {
	void showNewDashboard(router, createDashboard(position).id);
}

/** Show a dashboard that was just created. Closing it before going anywhere else goes back to the page it was opened from. */
export async function showNewDashboard(router: RegisteredRouter, id: string): Promise<void> {
	const opener = { pathname: router.state.location.pathname, dashboardId: currentDashboard(router)?.id };
	await router.navigate({ to: '/dashboards/$dashboardId', params: { dashboardId: id }, state: { opener } });
}

export function currentDashboard(router: RegisteredRouter): Dashboard | undefined {
	const match = router.state.matches.find((other) => other.routeId === '/dashboards/$dashboardId');
	return match && getDashboard(match.params.dashboardId);
}

/** Open another Studio window, desktop only */
export function newWindow(): void {
	void invoke('new_window');
}

/** On desktop, closes the window once there's no dashboard left to close */
export function closeFocused(router: RegisteredRouter): void {
	const dashboard = currentDashboard(router) ?? shownTuningDashboard(router);
	if (dashboard) {
		// Video export mode keeps the layout it previews
		if (!isExportingVideo()) {
			closeFocusedPane(dashboard.id);
		}
	} else if (desktop) {
		void closeWindow();
	}
}

async function closeWindow(): Promise<void> {
	if (await confirm('Close this window?', { okLabel: 'Close Window', cancelLabel: 'Cancel' })) {
		await getCurrentWindow().close();
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

	const dashboard = currentDashboard(router) ?? shownTuningDashboard(router);
	if (dashboard && !isExportingVideo()) {
		(direction === 'undo' ? undoDashboard : redoDashboard)(dashboard.id);
	}
}

function toggleFocusedZoom(router: RegisteredRouter): void {
	const dashboard = currentDashboard(router) ?? shownTuningDashboard(router);
	if (dashboard && !isExportingVideo()) {
		toggleZoom(dashboard.id, getFocusedPane(dashboard).id);
	}
}

function toggleFocusedEditing(router: RegisteredRouter): void {
	const dashboard = currentDashboard(router) ?? shownTuningDashboard(router);
	if (!dashboard || isExportingVideo()) {
		return;
	}

	const pane = getFocusedPane(dashboard);
	const type = pane.widget && getWidgetType(pane.widget.type);
	if (type && bindsEntries(type)) {
		toggleEditing(dashboard.id, pane.id);
	}
}

function splitFocused(router: RegisteredRouter, direction: SplitDirection): void {
	const dashboard = currentDashboard(router) ?? shownTuningDashboard(router);
	if (!dashboard || isExportingVideo()) {
		return;
	}

	splitDashboardPane(dashboard.id, getFocusedPane(dashboard).id, direction);
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

/** Open the dialog for loading a log from an HTTP(S) URL */
export function openLogUrlPrompt(): void {
	openLogUrlDialogOpen.set(true);
}

/** Connect to the robot target from Settings, or the simulator */
export function startConnect(): void {
	void connect(getRobotHost(settingsStore.get().robotTarget));
}

/** Switch between the log and the live session, when both are open */
function switchSource(): void {
	showSource(getSource()?.type === 'log' ? 'live' : 'log');
}

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
			...(STUDIO_DESKTOP ? [{ hotkey: shortcuts.newWindow, callback: newWindow, options: desktopOnly }] : []),
			{ hotkey: 'Mod+T', callback: () => newDashboard(router), options: desktopOnly },
			{ hotkey: 'Mod+W', callback: () => closeFocused(router), options: desktopOnly },
			{ hotkey: 'Mod+Shift+W', callback: () => closeCurrentDashboard(router), options: desktopOnly },
			{ hotkey: 'Mod+Shift+T', callback: () => reopenDashboard(router), options: desktopOnly },
			{
				hotkey: shortcuts.copyDashboardLink,
				callback: (event) => {
					const dashboard = currentDashboard(router);
					if (dashboard && canCopyDashboardLink(dashboard)) {
						event.preventDefault();
						void copyDashboardLink(dashboard);
					}
				},
				options: { preventDefault: false, stopPropagation: false },
			},
			{ hotkey: 'Mod+,', callback: () => openSettings(router), options: desktopOnly },
			{ hotkey: 'Mod+L', callback: () => openLogs(router), options: { enabled: desktop } },
			{ hotkey: shortcuts.update, callback: () => void checkOrInstallUpdate() },
			{ hotkey: 'Mod+[', callback: () => goInHistory(router, -1), options: desktopOnly },
			{ hotkey: 'Mod+]', callback: () => goInHistory(router, 1), options: desktopOnly },
			{ hotkey: shortcuts.connect, callback: startConnect },
			{ hotkey: shortcuts.switchSource, callback: switchSource },
			{ hotkey: shortcuts.splitRight, callback: () => splitFocused(router, 'row') },
			{ hotkey: shortcuts.splitDown, callback: () => splitFocused(router, 'column') },
			{ hotkey: shortcuts.zoom, callback: () => toggleFocusedZoom(router) },
			{ hotkey: shortcuts.editEntries, callback: () => toggleFocusedEditing(router) },
			{ hotkey: shortcuts.openLog, callback: chooseLog, options: outsideNativeMenu },
			{ hotkey: shortcuts.openLogUrl, callback: openLogUrlPrompt, options: outsideNativeMenu },
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
			...(redoAlternate === undefined
				? []
				: [{ hotkey: redoAlternate, callback: () => undoOrRedo(router, 'redo'), options: { ignoreInputs: true } }]),
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
