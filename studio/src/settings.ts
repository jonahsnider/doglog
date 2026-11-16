import { useSelector } from '@tanstack/react-store';
import * as z from 'zod';
import { createPersistedAtom } from '@/lib/persisted-store';
import { applyThemeColor, contrasts, defaultCustomColor, defaultThemeColor, themePresets } from '@/theme-color';

export const themes = ['light', 'dark', 'system'] as const;
export type Theme = (typeof themes)[number];

// Invalid fields fall back to their defaults
const settingsSchema = z
	.object({
		theme: z.enum(themes).catch('system'),
		themePreset: z.enum(themePresets).optional().catch(undefined),
		/** Hex color that the Custom preset's color scheme is generated from */
		themeColor: z
			.string()
			.regex(/^#[\da-f]{6}$/iu)
			.optional()
			.catch(undefined),
		contrast: z.enum(contrasts).catch('standard'),
		/** Team number or IP address, use `getRobotHost()` to get the NT server host */
		robotTarget: z.string().catch(''),
		/** Whether media keys and the OS's media controls control log playback */
		mediaControls: z.boolean().catch(false),
	})
	.transform(({ themePreset, themeColor, ...settings }) => {
		if (themePreset !== undefined) {
			return { ...settings, themePreset, themeColor: themeColor ?? defaultCustomColor };
		}
		// Older settings only store a theme color, where Team 581 maroon was the default
		return themeColor === undefined || themeColor.toLowerCase() === defaultThemeColor
			? { ...settings, themePreset: 'team581' as const, themeColor: defaultCustomColor }
			: { ...settings, themePreset: 'custom' as const, themeColor };
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

/**
 * Keep the `dark` class on the root element in sync with the theme setting and the OS color scheme, and the colors in sync
 * with the theme color and contrast settings
 */
export function syncTheme(): void {
	const darkQuery = matchMedia('(prefers-color-scheme: dark)');
	let appliedThemeColor: string | undefined;
	let appliedThemePreset: Settings['themePreset'] | undefined;
	let appliedContrast: Settings['contrast'] | undefined;
	const applyTheme = () => {
		const { theme, themeColor, themePreset, contrast } = settingsStore.get();
		document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && darkQuery.matches));
		// Other settings changes, ex. typing a robot target, don't need the colors regenerated
		if (themeColor !== appliedThemeColor || themePreset !== appliedThemePreset || contrast !== appliedContrast) {
			applyThemeColor(themeColor, themePreset, contrast);
			appliedThemeColor = themeColor;
			appliedThemePreset = themePreset;
			appliedContrast = contrast;
		}
	};

	applyTheme();
	darkQuery.addEventListener('change', applyTheme);
	settingsStore.subscribe(applyTheme);
}
