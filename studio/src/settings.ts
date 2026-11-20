import { useSelector } from '@tanstack/react-store';
import * as z from 'zod';
import { createPersistedAtom } from '@/lib/persisted-store';
import { contrasts, themePresets, themes } from '@/theme/choices';
import { applyThemeColor, defaultCustomColor, defaultThemeColor } from '@/theme/theme-color';

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
		/** Whether to reduce motion even when the system doesn't ask to, see `reducesMotion()` */
		reduceMotion: z.boolean().catch(false),
		/** Shown to others in shared dashboards, see `getDisplayName()` */
		name: z.string().catch(''),
		/** Team number or IP address, use `getRobotHost()` to get the NT server host */
		robotTarget: z.string().catch(''),
		/** Whether media keys and the OS's media controls control log playback */
		mediaControls: z.boolean().catch(false),
		/** Whether the timeline bar shows when alerts were active */
		timelineAlerts: z.boolean().catch(true),
		/** Whether long disabled stretches are compressed on the timeline and fast-forwarded through during playback */
		timelineCompress: z.boolean().catch(true),
		/** Whether the timeline bar shows when the robot's alliance hub was active in 2026 matches */
		timelineShifts: z.boolean().catch(true),
		/** Whether the system uses natural scrolling, for browsers that don't report it, see `reportsNaturalScrolling` */
		naturalScrolling: z.boolean().catch(true),
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

/** WebKit reports whether each scroll uses natural scrolling, so the setting is only needed elsewhere */
export const reportsNaturalScrolling =
	typeof WheelEvent !== 'undefined' && 'webkitDirectionInvertedFromDevice' in WheelEvent.prototype;

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
 * Keep the `dark` class on the root element in sync with the theme setting and the OS color scheme, the colors in sync
 * with the theme color and contrast settings, and the `reduce-motion` class in sync with the reduce motion setting
 */
export function syncTheme(): void {
	const darkQuery = matchMedia('(prefers-color-scheme: dark)');
	let appliedThemeColor: string | undefined;
	let appliedThemePreset: Settings['themePreset'] | undefined;
	let appliedContrast: Settings['contrast'] | undefined;
	const applyTheme = () => {
		const { theme, themeColor, themePreset, contrast, reduceMotion } = settingsStore.get();
		document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && darkQuery.matches));
		document.documentElement.classList.toggle('reduce-motion', reduceMotion);
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
