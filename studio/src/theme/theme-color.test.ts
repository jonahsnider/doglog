import { afterEach, expect, test, vi } from 'vite-plus/test';
import { themePresets, visualizationPalettes } from '@/theme/choices';
import { seriesOutline, seriesPaletteColors, seriesPaletteVariables } from './series-palette.ts';
import {
	applyThemeColor,
	defaultCustomColor,
	defaultThemeColor,
	themeColors,
	themeColorVariables,
	themePreviewColors,
} from './theme-color.ts';

afterEach(() => {
	vi.unstubAllGlobals();
});

/** WCAG relative luminance of a `#rrggbb` color */
function luminance(color: string): number {
	const [red, green, blue] = [1, 3, 5].map((index) => {
		const channel = Number.parseInt(color.slice(index, index + 2), 16) / 255;
		return channel <= 0.040_45 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}

/** WCAG contrast ratio of two `#rrggbb` colors */
function contrastRatio(a: string, b: string): number {
	const [light, dark] = [luminance(a), luminance(b)].toSorted((x, y) => y - x);
	return (light! + 0.05) / (dark! + 0.05);
}

/** CIE L* of a `#rrggbb` color */
const lstar = (color: string) => 116 * Math.cbrt(luminance(color)) - 16;

const channels = (color: string) => [1, 3, 5].map((index) => Number.parseInt(color.slice(index, index + 2), 16));

test('match13 dark actions and their preview use the site blue', () => {
	expect(themeColorVariables(defaultThemeColor, true, false, 'match13')).toContain('--studio-color-accent:#29a3f6;');
	expect(themePreviewColors('match13', defaultThemeColor, true, false).primary).toBe('#29a3f6');
});

// Custom colors include a saturated one and a near-black one, which seed the custom neutral too
const cases = themePresets.flatMap((preset) =>
	(preset === 'custom' ? [defaultCustomColor, '#3366ff', '#ffe600'] : [defaultThemeColor]).flatMap((color) =>
		[false, true].map((dark) => [preset, color, dark] as const),
	),
);

test.each(cases)(
	'%s (%s, dark: %s) text and accent labels are readable with and without high contrast',
	(preset, color, dark) => {
		const ratios = (highContrast: boolean) => {
			const { tokens } = themeColors(color, dark, highContrast, preset);
			const surface = tokens['--color-background-surface']!;
			expect(contrastRatio(tokens['--color-on-accent']!, tokens['--color-accent']!)).toBeGreaterThanOrEqual(4.5);
			return {
				text: contrastRatio(tokens['--color-text-secondary']!, surface),
				border: contrastRatio(tokens['--color-border-emphasized']!, surface),
			};
		};
		const standard = ratios(false);
		const high = ratios(true);
		expect(standard.text).toBeGreaterThanOrEqual(4.5);
		// High contrast makes secondary text stronger, and emphasized borders readable boundaries
		expect(high.text).toBeGreaterThan(standard.text);
		expect(high.border).toBeGreaterThanOrEqual(3);
	},
);

test.each([false, true])('FrogLog uses a green accent and blue selected items (dark: %s)', (dark) => {
	const { tokens } = themeColors(defaultThemeColor, dark, false, 'froglog');
	const [accentRed, accentGreen, accentBlue] = channels(tokens['--color-accent']!);
	const [selectedRed, selectedGreen, selectedBlue] = channels(tokens['--color-accent-muted']!);
	expect(accentGreen).toBeGreaterThan(Math.max(accentRed!, accentBlue!));
	expect(selectedBlue).toBeGreaterThan(Math.max(selectedRed!, selectedGreen!));
});

test.each(
	[false, true].flatMap((dark) =>
		[false, true].flatMap((highContrast) =>
			[
				'--color-accent',
				'--color-accent-muted',
				'--color-background-surface',
				'--color-background-popover',
				'--color-border-emphasized',
			].map((token) => [dark, highContrast, token] as const),
		),
	),
)('neutral (dark: %s, high contrast: %s) %s is untinted', (dark, highContrast, token) => {
	// Equal red, green, and blue
	expect(themeColors(defaultThemeColor, dark, highContrast, 'neutral').tokens[token]).toMatch(/^#(\w\w)\1\1$/u);
});

test('switching presets restores the chosen scheme', () => {
	const style = { textContent: '' };
	vi.stubGlobal('document', { querySelector: () => style });
	vi.stubGlobal('localStorage', { setItem: () => {} });

	applyThemeColor('#123456', 'custom', false, 'default');
	const customCss = style.textContent;
	expect(customCss).toContain(themeColorVariables('#123456', false, false, 'custom'));
	expect(customCss).toContain(themeColorVariables('#123456', true, false, 'custom'));

	applyThemeColor('#123456', 'doglog', false, 'default');
	expect(style.textContent).toContain(themeColorVariables(defaultThemeColor, false, false, 'doglog'));

	applyThemeColor('#123456', 'custom', false, 'default');
	expect(style.textContent).toBe(customCss);
});

test('high contrast applies when the system asks for more contrast, and always when it is on', () => {
	const style = { textContent: '' };
	vi.stubGlobal('document', { querySelector: () => style });
	vi.stubGlobal('localStorage', { setItem: () => {} });
	const high = themeColorVariables(defaultThemeColor, true, true, 'doglog');

	applyThemeColor(defaultThemeColor, 'doglog', false, 'default');
	const media = style.textContent.indexOf('@media (prefers-contrast: more)');
	expect(style.textContent.slice(0, media)).not.toContain(high);
	expect(style.textContent.slice(media)).toContain(high);

	applyThemeColor(defaultThemeColor, 'doglog', true, 'default');
	expect(style.textContent).toContain(high);
	expect(style.textContent).not.toContain('prefers-contrast');
});

test.each(
	visualizationPalettes.flatMap((palette) =>
		(['light', 'dark'] as const).map((mode) => [palette, mode, mode === 'dark'] as const),
	),
)('%s %s series are distinct, stand out from every preset, and have outlines a step away', (palette, mode, dark) => {
	const colors = seriesPaletteColors[palette][mode];
	expect(new Set(colors).size).toBe(5);
	for (const preset of themePresets) {
		const surface = themeColors(defaultThemeColor, dark, false, preset).tokens['--color-background-surface']!;
		for (const color of colors) {
			expect(contrastRatio(color, surface)).toBeGreaterThanOrEqual(3);
		}
	}
	for (const color of colors) {
		const step = lstar(seriesOutline(color)) - lstar(color);
		// Darker, unless the fill is so dark that a darker outline would be black
		expect(Math.sign(step)).toBe(Math.sign(25 - lstar(color)));
		expect(Math.abs(step)).toBeGreaterThan(5);
		expect(Math.abs(step)).toBeLessThan(20);
	}
});

test.each([false, true])('deutan includes a neutral series color instead of another hue (dark: %s)', (dark) => {
	expect(seriesPaletteVariables('deutan', dark)).toMatch(/--series-[1-5]:#([\da-f]{2})\1\1;/u);
});
