import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
import { sidebarCollapsedStore } from '@/sidebar/sidebar';

/** Whether the macOS window controls are drawn over the app instead of a title bar, see `titleBarStyle` in `tauri.conf.json` */
const overlayTitleBar = isTauri() && navigator.userAgent.includes('Mac');

/** Lets the window be dragged from an element, like a title bar. Buttons and other controls inside it still get clicks. */
export const dragRegion = overlayTitleBar ? { 'data-tauri-drag-region': 'deep' } : {};

const fullscreenStore = createAtom(false);

if (overlayTitleBar) {
	const window = getCurrentWindow();
	const update = async () => fullscreenStore.set(await window.isFullscreen());
	void update();
	void window.onResized(() => void update());
}

/** Whether the traffic lights are shown over the top left of the app, macOS hides them in fullscreen */
export function useTrafficLights(): boolean {
	const fullscreen = useSelector(fullscreenStore);
	return overlayTitleBar && !fullscreen;
}

/** Whether the traffic lights overlap the top left of the main area, they're wider than the collapsed sidebar */
export function useTrafficLightsOverlap(): boolean {
	const sidebarCollapsed = useSelector(sidebarCollapsedStore);
	return useTrafficLights() && sidebarCollapsed;
}
