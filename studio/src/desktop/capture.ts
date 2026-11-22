import type { RegisteredRouter } from '@tanstack/react-router';
import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { toastManager } from '@/components/ui/toast';
import { showVideoFrame } from '@/timeline/timeline';

export const canCapture = STUDIO_DESKTOP && '__DOGLOG_CAPTURE__' in window;

type CaptureArea = { bounds: DOMRect; paneIds: Set<string | undefined> };

const frame = createAtom<CaptureArea | undefined>(undefined);
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

		const area = captureArea(target);
		root.dataset['capturing'] = '';
		frame.set(area);
		await afterPaint();
		if (!stillCurrent()) {
			return undefined;
		}
		const rect = toRect(area.bounds);
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

/** The part of the window that a capture of `target` shows, and the panes in it */
function captureArea(target: HTMLElement): CaptureArea {
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
	return { bounds, paneIds };
}

/** `bounds` as fractions of the window, how the native capture takes them */
function toRect(bounds: DOMRect) {
	return {
		left: bounds.left / innerWidth,
		top: bounds.top / innerHeight,
		right: bounds.right / innerWidth,
		bottom: bounds.bottom / innerHeight,
	};
}

/**
 * Save a video of a dashboard's capture `target` as an MP4 at `path` (`null` for a temporary file), showing each of
 * `times` (µs) in turn as a frame, `fps` frames a second. Stops and deletes the file when `signal` aborts. Returns where
 * it was saved, or nothing when it was aborted.
 */
export async function saveVideo(
	target: HTMLElement,
	{
		path,
		times,
		fps,
		signal,
		onProgress,
	}: { path: string | null; times: number[]; fps: number; signal: AbortSignal; onProgress: (progress: number) => void },
): Promise<string | undefined> {
	if (capturing) {
		throw new Error('Another image is being captured.');
	}

	capturing = true;
	const root = document.documentElement;
	let started = false;
	try {
		// The video's own controls and any popups stay out of its frames, see the `saving-video` variant
		root.dataset['savingVideo'] = '';
		// Video export mode may have just opened, which changes the dashboard's size
		await afterPaint();
		const area = captureArea(target);
		frame.set(area);
		const rect = toRect(area.bounds);
		const saved = await invoke<string>('start_video', { path, fps });
		started = true;
		for (const [index, time] of times.entries()) {
			if (signal.aborted) {
				return undefined;
			}
			showVideoFrame(time);
			// oxlint-disable-next-line no-await-in-loop -- Each frame has to be shown before it's captured.
			await widgetsLoaded(target);
			// oxlint-disable-next-line no-await-in-loop -- The encoder takes frames in order.
			await invoke('add_video_frame', { rect });
			onProgress((index + 1) / times.length);
		}
		await invoke('finish_video');
		started = false;
		return saved;
	} finally {
		if (started) {
			await invoke('cancel_video').catch(() => undefined);
		}
		showVideoFrame(undefined);
		delete root.dataset['savingVideo'];
		frame.set(undefined);
		capturing = false;
	}
}

/** Let the webview paint `target`, then wait for its visible widgets to finish loading */
async function widgetsLoaded(target: Element): Promise<void> {
	const deadline = performance.now() + 10_000;
	await afterPaint();
	while (
		Array.from(target.querySelectorAll('[data-capture-pending]')).some((pending) =>
			pending.checkVisibility({ visibilityProperty: true }),
		)
	) {
		if (performance.now() >= deadline) {
			throw new Error('The dashboard didn’t finish loading in time.');
		}
		// oxlint-disable-next-line no-await-in-loop -- Each check needs a fresh paint.
		await afterPaint();
	}
}
