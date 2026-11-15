import { useSelector } from '@tanstack/react-store';
import * as z from 'zod';
import { createPersistedAtom } from '@/lib/persisted-store';

export const themes = ['light', 'dark', 'system'] as const;
export type Theme = (typeof themes)[number];

// Invalid fields fall back to their defaults
const settingsSchema = z.object({
	theme: z.enum(themes).catch('system'),
	/** Team number or IP address, use `getRobotHost()` to get the NT server host */
	robotTarget: z.string().catch(''),
});

export type Settings = z.infer<typeof settingsSchema>;

/**
 * Use `settingsStore.get()` to read settings outside React, ex. when connecting to a robot.
 * `index.html` also reads the theme from this storage key before render, keep them in sync.
 * @public
 */
export const settingsStore = createPersistedAtom('settings', settingsSchema, settingsSchema.parse({}));

export function useSettings(): Settings {
	return useSelector(settingsStore);
}

export function updateSettings(changes: Partial<Settings>): void {
	settingsStore.set((settings) => ({ ...settings, ...changes }));
}

/** Keep the `dark` class on the root element in sync with the theme setting and the OS color scheme */
export function syncTheme(): void {
	const darkQuery = matchMedia('(prefers-color-scheme: dark)');
	const applyTheme = () => {
		const { theme } = settingsStore.get();
		document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && darkQuery.matches));
	};

	applyTheme();
	darkQuery.addEventListener('change', applyTheme);
	settingsStore.subscribe(applyTheme);
}
