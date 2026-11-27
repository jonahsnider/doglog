// oxlint-disable landmines/no-test-doubles -- Tests run without a DOM, so they provide the browser globals themselves
import { modeOklch, useMode as registerMode } from 'culori/fn';
import { afterEach, expect, test, vi } from 'vite-plus/test';
import { themePresets, visualizationPalettes } from '@/theme/choices';
import { seriesOutline, seriesPaletteColors, seriesPaletteVariables } from './series-palette.ts';
import {
	applyThemeColor,
	defaultCustomColor,
	defaultThemeColor,
	type PresetInputs,
	type TeamColors,
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

const oklch = registerMode(modeOklch);

const inputs = (themeColor: string, teamColors: TeamColors | null = null): PresetInputs => ({ themeColor, teamColors });

const channels = (color: string) => [1, 3, 5].map((index) => Number.parseInt(color.slice(index, index + 2), 16));

test('match13 dark actions and their preview use the site blue', () => {
	expect(themeColorVariables(inputs(defaultThemeColor), true, false, 'match13')).toContain(
		'--studio-color-accent:#29a3f6;',
	);
	expect(themePreviewColors('match13', inputs(defaultThemeColor), true, false).primary).toBe('#29a3f6');
});

// Custom colors include a saturated one and a near-black one, which seed the custom neutral too. Team colors include
// a near-black secondary, a pale primary, and none.
const teams: (TeamColors | null)[] = [
	{ primary: '#591616', secondary: '#e86d38' },
	{ primary: '#3cd52e', secondary: '#242424' },
	{ primary: '#ffe600', secondary: '#ffffff' },
	null,
];
const cases = themePresets.flatMap((preset) => {
	let presetInputs = [inputs(defaultThemeColor)];
	if (preset === 'custom') {
		presetInputs = [defaultCustomColor, '#3366ff', '#ffe600'].map((color) => inputs(color));
	} else if (preset === 'frc-colors') {
		presetInputs = teams.map((team) => inputs(defaultCustomColor, team));
	}
	return presetInputs.flatMap((input) =>
		[false, true].map((dark) => [preset, JSON.stringify(input), dark, input] as const),
	);
});

test.each(cases)(
	'%s (%s, dark: %s) text and accent labels are readable with and without high contrast',
	(preset, _, dark, input) => {
		const ratios = (highContrast: boolean) => {
			const { tokens } = themeColors(input, dark, highContrast, preset);
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
	const { tokens } = themeColors(inputs(defaultThemeColor), dark, false, 'froglog');
	const [accentRed, accentGreen, accentBlue] = channels(tokens['--color-accent']!);
	const [selectedRed, selectedGreen, selectedBlue] = channels(tokens['--color-accent-muted']!);
	expect(accentGreen).toBeGreaterThan(Math.max(accentRed!, accentBlue!));
	expect(selectedBlue).toBeGreaterThan(Math.max(selectedRed!, selectedGreen!));
});

test.each([false, true])(
	'FRC Colors uses the team primary for actions and secondary for selected items (dark: %s)',
	(dark) => {
		// Team 1678's green and near-black, so selected items are gray rather than a tint of the green
		const { tokens } = themeColors(inputs(defaultCustomColor, teams[1]), dark, false, 'frc-colors');
		const [accentRed, accentGreen, accentBlue] = channels(tokens['--color-accent']!);
		expect(accentGreen).toBeGreaterThan(Math.max(accentRed!, accentBlue!));
		expect(oklch(tokens['--color-accent-muted'])!.c).toBeLessThan(0.02);
	},
);

test.each([false, true])('FRC Colors without team colors looks like DogLog (dark: %s)', (dark) => {
	expect(themeColors(inputs(defaultCustomColor), dark, false, 'frc-colors')).toStrictEqual(
		themeColors(inputs(defaultCustomColor), dark, false, 'doglog'),
	);
});

test.each(['--color-background-body', '--color-background-surface'])('HogLog dark %s is near gray', (token) => {
	// MD3's tonal spot surfaces for the same pink reach 0.017 OKLCH chroma
	expect(oklch(themeColors(inputs(defaultThemeColor), true, false, 'hoglog').tokens[token])!.c).toBeLessThan(0.02);
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
	expect(themeColors(inputs(defaultThemeColor), dark, highContrast, 'neutral').tokens[token]).toMatch(/^#(\w\w)\1\1$/u);
});

test('switching presets restores the chosen scheme', () => {
	const style = { textContent: '' };
	vi.stubGlobal('document', { querySelector: () => style });
	vi.stubGlobal('localStorage', { setItem: () => {} });

	applyThemeColor(inputs('#123456'), 'custom', false, 'default');
	const customCss = style.textContent;
	expect(customCss).toContain(themeColorVariables(inputs('#123456'), false, false, 'custom'));
	expect(customCss).toContain(themeColorVariables(inputs('#123456'), true, false, 'custom'));

	applyThemeColor(inputs('#123456'), 'doglog', false, 'default');
	expect(style.textContent).toContain(themeColorVariables(inputs(defaultThemeColor), false, false, 'doglog'));

	applyThemeColor(inputs('#123456'), 'custom', false, 'default');
	expect(style.textContent).toBe(customCss);
});

test('high contrast applies when the system asks for more contrast, and always when it is on', () => {
	const style = { textContent: '' };
	vi.stubGlobal('document', { querySelector: () => style });
	vi.stubGlobal('localStorage', { setItem: () => {} });
	const high = themeColorVariables(inputs(defaultThemeColor), true, true, 'doglog');

	applyThemeColor(inputs(defaultThemeColor), 'doglog', false, 'default');
	const media = style.textContent.indexOf('@media (prefers-contrast: more)');
	expect(style.textContent.slice(0, media)).not.toContain(high);
	expect(style.textContent.slice(media)).toContain(high);

	applyThemeColor(inputs(defaultThemeColor), 'doglog', true, 'default');
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
		const surface = themeColors(inputs(defaultThemeColor), dark, false, preset).tokens['--color-background-surface']!;
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
