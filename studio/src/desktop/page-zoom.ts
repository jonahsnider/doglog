import { getCurrentWebview } from '@tauri-apps/api/webview';

const levels = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
const actualSize = levels.indexOf(1);
let level = actualSize;

/** Zoom the focused window's entire page without changing widget zoom or scroll gestures. */
export function zoomPage(step: -1 | 0 | 1): void {
	level = step === 0 ? actualSize : Math.min(levels.length - 1, Math.max(0, level + step));
	void getCurrentWebview().setZoom(levels[level]!);
}
