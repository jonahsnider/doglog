import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { confirm } from '@tauri-apps/plugin-dialog';
import type { RegisteredRouter } from '@tanstack/react-router';
import { closeFocusedPane } from '@/dashboards/panes';
import {
	createDashboard,
	deleteDashboard,
	getDashboards,
	getDoc,
	redoDashboard,
	reopenClosedDashboards,
	undoDashboard,
} from '@/dashboards/dashboards';
import { openLogUrlDialogOpen } from '@/components/open-log-url-dialog-handle';
import { currentDashboard } from '@/commands/dashboard-commands';
import {
	dashboardNumbers,
	dashboardShortcut,
	nativeMenu,
	redoAlternate,
	shortcuts,
	useShortcutHint,
} from '@/commands/shortcuts';
import { isExportingVideo } from '@/desktop/video-export';
import { connect } from '@/data/source';
import { shownTuningDashboard } from '@/tuning/dashboard';
import { getRobotHost } from '@/robot-target';
import { robotTargetStore } from '@/settings';

export { dashboardNumbers, dashboardShortcut, nativeMenu, redoAlternate, shortcuts, useShortcutHint };

const desktop = STUDIO_DESKTOP;

export function newDashboard(router: RegisteredRouter, position?: 'top' | 'bottom'): void {
	void showNewDashboard(router, createDashboard(position).id);
}

/** Show a dashboard that was just created. Closing it before going anywhere else goes back to the page it was opened from. */
export async function showNewDashboard(router: RegisteredRouter, id: string): Promise<void> {
	const opener = { pathname: router.state.location.pathname, dashboardId: currentDashboard(router)?.id };
	await router.navigate({ to: '/dashboards/$dashboardId', params: { dashboardId: id }, state: { opener } });
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

/** Text fields keep their own history, which can't be read, so they can always try */
export function canUndoOrRedo(router: RegisteredRouter, direction: 'undo' | 'redo'): boolean {
	if (isEditingText()) {
		return true;
	}
	const dashboard = currentDashboard(router) ?? shownTuningDashboard(router);
	return dashboard !== undefined && !isExportingVideo() && getDoc(dashboard.id).canTravel(direction);
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

export function openDashboardAt(router: RegisteredRouter, index: number): void {
	const dashboard = getDashboards()[index];
	if (dashboard) {
		void router.navigate({ to: '/dashboards/$dashboardId', params: { dashboardId: dashboard.id } });
	}
}

export function openSettings(router: RegisteredRouter): void {
	void router.navigate({ to: '/settings' });
}

export function openLogs(router: RegisteredRouter): void {
	void router.navigate({ to: '/logs' });
}

/** Open the dialog for loading a log from an HTTP(S) URL */
export function openLogUrlPrompt(): void {
	openLogUrlDialogOpen.set(true);
}

/** Connect to the robot target from Settings, or the simulator */
export function startConnect(): void {
	void connect(getRobotHost(robotTargetStore.get()));
}
