import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import * as z from 'zod';
import { teamDefaultsStore } from '@/cloud/session';
import { createPersistedAtom } from '@/lib/persisted-store';
import { themePresets, themes, visualizationPalettes } from '@/theme/choices';
import { applyThemeColor, defaultCustomColor, themeColors } from '@/theme/theme-color';

const settingsSchema = z.object({
	theme: z.enum(themes).catch('system'),
	themePreset: z.enum(themePresets).catch('doglog'),
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
	/** Whether to use a solid window frame even when the system doesn't ask to reduce transparency */
	reduceTransparency: z.boolean().catch(false),
	/** Local sharing name, used when signed out of Cloud */
	name: z.string().catch(''),
	/** Team number or IP address, blank to use the Cloud team's default. Connecting uses `robotTargetStore`. */
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

/** The desktop app shows a native backdrop through the window frame, so reducing transparency only matters there */
export const hasFrostedFrame = STUDIO_DESKTOP && '__DOGLOG_FROSTED_FRAME__' in window;
/** Whether the window's backdrop is tinted natively with the theme's colors, instead of by the frame's background */
export const hasNativeBackdrop = hasFrostedFrame && '__DOGLOG_NATIVE_BACKDROP__' in window;

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
 * The robot connection target, from the setting or, while it's blank, the Cloud team's default team number.
 * Use `getRobotHost()` to get the NT server host.
 */
export const robotTargetStore = createAtom(() => {
	const target = settingsStore.get().robotTarget.trim();
	const teamNumber = teamDefaultsStore.get()?.teamNumber ?? null;
	return target === '' && teamNumber !== null ? String(teamNumber) : target;
});

export function useRobotTarget(): string {
	return useSelector(robotTargetStore);
}

/** The color mode the theme setting resolves to, following the OS color scheme for `system` */
export const colorModeStore = createAtom<'light' | 'dark'>('light');

/**
 * Keep the `dark` class on the root element in sync with the theme setting and the OS color scheme, the colors in sync
 * with the color settings, and the `reduce-motion` and `reduce-transparency` classes in sync with their settings
 */
export function syncTheme(): void {
	const darkQuery = matchMedia('(prefers-color-scheme: dark)');
	let appliedTheme: Settings['theme'] | undefined;
	let appliedBackdrop: string | undefined;
	let appliedThemeColor: string | undefined;
	let appliedThemePreset: Settings['themePreset'] | undefined;
	let appliedHighContrast: boolean | undefined;
	let appliedVisualizationPalette: Settings['visualizationPalette'] | undefined;
	const applyTheme = () => {
		const { theme, themeColor, themePreset, highContrast, visualizationPalette, reduceMotion, reduceTransparency } =
			settingsStore.get();
		const dark = theme === 'dark' || (theme === 'system' && darkQuery.matches);
		document.documentElement.classList.toggle('dark', dark);
		colorModeStore.set(dark ? 'dark' : 'light');
		// The window's native backdrop follows the window's appearance, not the page's
		if (STUDIO_DESKTOP && theme !== appliedTheme) {
			void getCurrentWindow().setTheme(theme === 'system' ? null : theme);
			appliedTheme = theme;
		}
		document.documentElement.classList.toggle('reduce-motion', reduceMotion);
		document.documentElement.classList.toggle('reduce-transparency', reduceTransparency);
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
		if (hasNativeBackdrop) {
			const { tokens } = themeColors(themeColor, dark, highContrast, themePreset);
			const backdrop = {
				body: tokens['--color-background-body']!,
				surface: tokens['--color-background-surface']!,
				dark,
			};
			const key = JSON.stringify(backdrop);
			if (key !== appliedBackdrop) {
				appliedBackdrop = key;
				void invoke('set_window_backdrop', backdrop);
			}
		}
	};

	applyTheme();
	darkQuery.addEventListener('change', applyTheme);
	settingsStore.subscribe(applyTheme);
}
