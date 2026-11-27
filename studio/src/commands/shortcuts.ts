import { detectPlatform, getKeyStateTracker, type Hotkey, matchesHeldModifiers } from '@tanstack/react-hotkeys';
import { useSelector } from '@tanstack/react-store';
import { useDebounceValue } from 'usehooks-ts';
import { updateShortcut } from '@/updater';

const desktop = STUDIO_DESKTOP;
/** macOS already uses ⌘W for its default Close Window menu item, so the desktop-only shortcuts are menu items there */
export const nativeMenu = desktop && detectPlatform() === 'mac';

/** Browsers reserve the ⌘ versions of these, so the web app only has the Alt versions */
export const shortcuts = {
	newWindow: 'Mod+N',
	newDashboard: desktop ? 'Mod+T' : 'Alt+T',
	close: desktop ? 'Mod+W' : 'Alt+W',
	closeDashboard: desktop ? 'Mod+Shift+W' : 'Alt+Shift+W',
	reopenDashboard: desktop ? 'Mod+Shift+T' : 'Alt+Shift+T',
	copyDashboardLink: 'Mod+Shift+C',
	copyDashboardImage: 'Mod+C',
	exportVideo: 'Mod+R',
	settings: desktop ? 'Mod+,' : 'Alt+,',
	logs: desktop ? 'Mod+L' : 'Alt+L',
	back: desktop ? 'Mod+[' : 'Alt+[',
	forward: desktop ? 'Mod+]' : 'Alt+]',
	connect: 'Mod+K',
	splitRight: 'Mod+D',
	splitDown: 'Mod+Shift+D',
	splitLeft: 'Mod+Shift+ArrowLeft',
	splitUp: 'Mod+Shift+ArrowUp',
	splitBestFit: 'Mod+Enter',
	zoom: 'Mod+Shift+Enter',
	editEntries: 'Mod+E',
	openLog: 'Mod+O',
	openLogUrl: 'Mod+Shift+O',
	undo: 'Mod+Z',
	redo: 'Mod+Shift+Z',
	toggleSidebar: 'Mod+B',
	toggleEntryBrowser: 'Mod+Alt+B',
	keyboardShortcuts: 'Mod+/',
	commandPalette: 'Mod+P',
	findInConsole: 'Mod+F',
	searchEntries: '/',
	update: updateShortcut,
} as const satisfies Record<string, Hotkey>;

/** Windows and Linux also redo with Ctrl+Y */
export const redoAlternate: Hotkey | undefined = detectPlatform() === 'mac' ? undefined : 'Mod+Y';

export const dashboardNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

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
	const [delayed] = useDebounceValue(held, 300);
	return held && delayed;
}
