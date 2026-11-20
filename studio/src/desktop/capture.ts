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

/** Wait until the webview has painted the styles and pinned readouts from the new capture state. */
function afterPaint(): Promise<void> {
	return new Promise((resolve) => {
		requestAnimationFrame(() => {
			requestAnimationFrame(() => resolve());
		});
	});
}

export async function copyImage(target: Element | null): Promise<void> {
	if (!target || !target.isConnected || copying) {
		return;
	}

	copying = true;
	const root = document.documentElement;
	let covered = false;
	try {
		if ('__DOGLOG_CAPTURE_COVER__' in window) {
			await invoke('set_capture_cover', { show: true });
			covered = true;
		}
		if (!target.isConnected) {
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
			(target instanceof HTMLElement && target.dataset['paneId'] !== undefined
				? [target]
				: [...target.querySelectorAll<HTMLElement>('[data-pane-id]')]
			)
				.filter((pane) => pane.checkVisibility({ visibilityProperty: true }))
				.map((pane) => pane.dataset['paneId']),
		);
		root.dataset['capturing'] = '';
		frame.set({ bounds, paneIds });
		await afterPaint();
		if (!target.isConnected) {
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
