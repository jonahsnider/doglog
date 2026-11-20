import type { RegisteredRouter } from '@tanstack/react-router';
import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { toastManager } from '@/components/ui/toast';

export const canCapture = isTauri() && '__DOGLOG_CAPTURE__' in window;

const frame = createAtom<{ bounds: DOMRect; paneIds: Set<string | undefined> } | undefined>(undefined);
let copying = false;

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
	let target = dashboardCaptureTarget(dashboardId);
	try {
		if (!target) {
			await router.navigate({ to: '/dashboards/$dashboardId', params: { dashboardId } });
			const deadline = performance.now() + 10_000;
			await afterPaint();
			target = dashboardCaptureTarget(dashboardId);
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
		}
		await copyImage(target);
	} catch (error) {
		toastManager.add({ type: 'error', title: 'Couldn’t copy image', description: String(error) });
	}
}

export async function copyImage(target: Element | null): Promise<void> {
	if (!(target instanceof HTMLElement) || !target.isConnected || copying) {
		return;
	}

	copying = true;
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
			return;
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
			return;
		}
		await invoke('copy_capture', {
			rect: {
				left: bounds.left / innerWidth,
				top: bounds.top / innerHeight,
				right: bounds.right / innerWidth,
				bottom: bounds.bottom / innerHeight,
			},
		});
	} catch (error) {
		toastManager.add({ type: 'error', title: 'Couldn’t copy image', description: String(error) });
	} finally {
		delete root.dataset['capturing'];
		frame.set(undefined);
		if (covered) {
			await afterPaint();
			// The native cover also expires if the webview can't remove it.
			await invoke('set_capture_cover', { show: false }).catch(() => undefined);
		}
		copying = false;
	}
}
