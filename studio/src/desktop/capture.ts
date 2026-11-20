import type { RegisteredRouter } from '@tanstack/react-router';
import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { toastManager } from '@/components/ui/toast';

export const canCapture = isTauri() && '__DOGLOG_CAPTURE__' in window;

const frame = createAtom<{ bounds: DOMRect; paneIds: Set<string | undefined> } | undefined>(undefined);
let capturing = false;

export function useCaptureFrame() {
	return useSelector(frame);
}

export function dashboardCaptureTarget(dashboardId: string): Element | null {
	return document.querySelector(`[data-capture-dashboard="${CSS.escape(dashboardId)}"]`);
}

/** Let the webview paint the dashboard or its capture styling. */
function afterPaint(): Promise<void> {
	return new Promise((resolve) => {
		requestAnimationFrame(() => {
			requestAnimationFrame(() => resolve());
		});
	});
}

export async function copyDashboardImage(router: RegisteredRouter, dashboardId: string): Promise<void> {
	try {
		await capture(await showDashboard(router, dashboardId));
	} catch (error) {
		toastManager.add({ type: 'error', title: 'Couldn’t copy image', description: String(error) });
	}
}

export async function copyImage(target: Element | null): Promise<void> {
	if (!(target instanceof HTMLElement) || !target.isConnected || capturing) {
		return;
	}
	try {
		await capture(target);
	} catch (error) {
		toastManager.add({ type: 'error', title: 'Couldn’t copy image', description: String(error) });
	}
}

/**
 * Save an image of a dashboard, or one of its panes, to `path` or a temporary file, for agents. Shows the dashboard
 * first, like copying its image, and restores the window if it's minimized. Returns where the image was saved.
 */
export async function saveCaptureImage(
	router: RegisteredRouter,
	{ dashboardId, paneId, path }: { dashboardId: string; paneId?: string | undefined; path?: string | undefined },
): Promise<string> {
	// A minimized window doesn't paint, so the capture would wait until the user restores it
	if (document.visibilityState === 'hidden') {
		await getCurrentWindow().unminimize();
	}
	const dashboard = await showDashboard(router, dashboardId);
	const target =
		paneId === undefined ? dashboard : dashboard.querySelector<HTMLElement>(`[data-pane-id="${CSS.escape(paneId)}"]`);
	if (target?.checkVisibility({ visibilityProperty: true }) !== true) {
		throw new Error('The pane is hidden, another pane is zoomed.');
	}
	const saved = await capture(target, path ?? null);
	if (saved === undefined) {
		throw new Error('The dashboard was replaced before it could be captured.');
	}
	return saved;
}

/** Show a dashboard and wait for its visible widgets to finish loading, then return its capture target. */
async function showDashboard(router: RegisteredRouter, dashboardId: string): Promise<HTMLElement> {
	if (!dashboardCaptureTarget(dashboardId)) {
		await router.navigate({ to: '/dashboards/$dashboardId', params: { dashboardId } });
	}
	const deadline = performance.now() + 10_000;
	await afterPaint();
	let target = dashboardCaptureTarget(dashboardId);
	while (
		target &&
		Array.from(target.querySelectorAll('[data-capture-pending]')).some((pending) =>
			pending.checkVisibility({ visibilityProperty: true }),
		)
	) {
		if (performance.now() >= deadline) {
			throw new Error('The dashboard didn’t finish loading in time.');
		}
		// oxlint-disable-next-line no-await-in-loop -- Each check needs a fresh paint.
		await afterPaint();
		target = dashboardCaptureTarget(dashboardId);
	}
	if (!(target instanceof HTMLElement)) {
		throw new TypeError('The dashboard isn’t shown.');
	}
	return target;
}

/**
 * Copy an image of `target`, or save it when `savePath` is given (`null` for a temporary file) and return where.
 * Returns nothing when the router replaced the dashboard before the capture.
 */
async function capture(target: HTMLElement, savePath?: string | null): Promise<string | undefined> {
	if (capturing) {
		throw new Error('Another image is being captured.');
	}

	capturing = true;
	const dashboardId = target.dataset['captureDashboard'];
	// The router can reuse the capture surface for a different dashboard.
	const stillCurrent = () => target.isConnected && target.dataset['captureDashboard'] === dashboardId;
	const root = document.documentElement;
	let covered = false;
	try {
		if ('__DOGLOG_CAPTURE_COVER__' in window) {
			await invoke('set_capture_cover', { show: true });
			covered = true;
		}
		if (!stillCurrent()) {
			return undefined;
		}

		const { left, top, right, bottom } = target.getBoundingClientRect();
		// The gap after a dashboard's panes belongs to the entry browser, so include as much as the dashboard pads its start.
		const end = target.matches('[data-capture-dashboard]')
			? // oxlint-disable-next-line unicorn/prefer-number-coercion -- Computed padding has a `px` suffix.
				right + Number.parseFloat(getComputedStyle(target).paddingLeft)
			: right;
		const x = Math.max(0, left);
		const y = Math.max(0, top);
		const bounds = new DOMRect(x, y, Math.min(innerWidth, end) - x, Math.min(innerHeight, bottom) - y);
		const paneIds = new Set(
			(target.dataset['paneId'] === undefined ? [...target.querySelectorAll<HTMLElement>('[data-pane-id]')] : [target])
				.filter((pane) => pane.checkVisibility({ visibilityProperty: true }))
				.map((pane) => pane.dataset['paneId']),
		);
		root.dataset['capturing'] = '';
		frame.set({ bounds, paneIds });
		await afterPaint();
		if (!stillCurrent()) {
			return undefined;
		}
		const rect = {
			left: bounds.left / innerWidth,
			top: bounds.top / innerHeight,
			right: bounds.right / innerWidth,
			bottom: bounds.bottom / innerHeight,
		};
		if (savePath === undefined) {
			await invoke('copy_capture', { rect });
			return undefined;
		}
		return await invoke<string>('save_capture', { rect, path: savePath });
	} finally {
		delete root.dataset['capturing'];
		frame.set(undefined);
		if (covered) {
			await afterPaint();
			// The native cover also expires if the webview can't remove it.
			await invoke('set_capture_cover', { show: false }).catch(() => undefined);
		}
		capturing = false;
	}
}
