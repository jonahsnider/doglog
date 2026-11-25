import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
import * as z from 'zod';
import { createPersistedAtom } from '@/lib/persisted-store';
import { themePresets, themes, visualizationPalettes } from '@/theme/choices';
import { applyThemeColor, defaultCustomColor } from '@/theme/theme-color';

const settingsSchema = z.object({
	theme: z.enum(themes).catch('system'),
	themePreset: z.enum(themePresets).catch('team581'),
	/** Hex color that the Custom preset's color scheme is generated from */
	themeColor: z
		.string()
		.regex(/^#[\da-f]{6}$/iu)
		.catch(defaultCustomColor),
	/** Whether to use high contrast colors even when the system doesn't ask for more contrast */
	highContrast: z.boolean().catch(false),
	visualizationPalette: z.enum(visualizationPalettes).catch('default'),
	/** Whether to reduce motion even when the system doesn't ask to, see `reducesMotion()` */
	reduceMotion: z.boolean().catch(false),
	/** Local sharing name, used when signed out of Cloud */
	name: z.string().catch(''),
	/** Team number or IP address, use `getRobotHost()` to get the NT server host */
	robotTarget: z.string().catch(''),
	/** Coalesce updates from live topics that aren't used on a dashboard */
	reduceLiveBandwidth: z.boolean().catch(false),
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

/** The color mode the theme setting resolves to, following the OS color scheme for `system` */
export const colorModeStore = createAtom<'light' | 'dark'>('light');

/**
 * Keep the `dark` class on the root element in sync with the theme setting and the OS color scheme, the colors in sync
 * with the color settings, and the `reduce-motion` class in sync with the reduce motion setting
 */
export function syncTheme(): void {
	const darkQuery = matchMedia('(prefers-color-scheme: dark)');
	let appliedThemeColor: string | undefined;
	let appliedThemePreset: Settings['themePreset'] | undefined;
	let appliedHighContrast: boolean | undefined;
	let appliedVisualizationPalette: Settings['visualizationPalette'] | undefined;
	const applyTheme = () => {
		const { theme, themeColor, themePreset, highContrast, visualizationPalette, reduceMotion } = settingsStore.get();
		const dark = theme === 'dark' || (theme === 'system' && darkQuery.matches);
		document.documentElement.classList.toggle('dark', dark);
		colorModeStore.set(dark ? 'dark' : 'light');
		document.documentElement.classList.toggle('reduce-motion', reduceMotion);
		// Other settings changes, ex. typing a robot target, don't need the colors regenerated
		if (
			themeColor !== appliedThemeColor ||
			themePreset !== appliedThemePreset ||
			highContrast !== appliedHighContrast ||
			visualizationPalette !== appliedVisualizationPalette
		) {
			applyThemeColor(themeColor, themePreset, highContrast, visualizationPalette);
			appliedThemeColor = themeColor;
			appliedThemePreset = themePreset;
			appliedHighContrast = highContrast;
			appliedVisualizationPalette = visualizationPalette;
		}
	};

	applyTheme();
	darkQuery.addEventListener('change', applyTheme);
	settingsStore.subscribe(applyTheme);
}
