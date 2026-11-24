import { Contrast, Hct, argbFromHex, lstarFromArgb } from '@material/material-color-utilities';
import { afterEach, assert, describe, expect, test, vi } from 'vite-plus/test';
import { themePresets, visualizationPalettes } from '@/theme/choices';
import css from '../index.css?raw';
import { seriesPaletteVariables } from './series-palette.ts';
import {
	applyThemeColor,
	chartColorVariables,
	defaultThemeColor,
	schemeColors,
	themeColorVariables,
	themePreviewColors,
} from './theme-color.ts';
import { statusColorVariables } from './status-color.ts';

afterEach(() => {
	vi.unstubAllGlobals();
});

function cssVariables(block: string): string[] {
	return Array.from(
		block.matchAll(/(--[a-z\d-]+): rgb\((\d+) (\d+) (\d+)\);/gu),
		([, name, ...rgb]) => `${name}:#${rgb.map((channel) => Number(channel).toString(16).padStart(2, '0')).join('')}`,
	);
}

function generatedVariables(dark: boolean): string[] {
	return (
		themeColorVariables(defaultThemeColor, dark, 'standard', 'team581') +
		chartColorVariables(defaultThemeColor, dark) +
		statusColorVariables(defaultThemeColor, dark)
	)
		.split(';')
		.filter(Boolean);
}

// The default colors in index.css are used before JS loads, so they must match the generated ones
describe('themeColorVariables()', () => {
	const light = css.slice(css.indexOf(':root {'), css.indexOf('.dark {'));
	const dark = css.slice(css.indexOf('.dark {'), css.indexOf('/* Map coss ui tokens'));

	test('default light colors match index.css', () => {
		expect(generatedVariables(false)).toStrictEqual(cssVariables(light));
	});

	test('default dark colors match index.css', () => {
		expect(generatedVariables(true)).toStrictEqual(cssVariables(dark));
	});

	test('match13 standard dark actions and their preview use the site blue', () => {
		expect(themeColorVariables(defaultThemeColor, true, 'standard', 'match13')).toContain('--md-primary:#29a3f6;');
		expect(themePreviewColors('match13', defaultThemeColor, true, 'standard').primary).toBe('#29a3f6');
	});

	test.each([
		['standard', 6],
		['medium', 7],
		['high', 11],
	] as const)('match13 dark primary labels retain %s contrast', (contrast, ratio) => {
		const variables = themeColorVariables(defaultThemeColor, true, contrast, 'match13');
		const primary = variables.match(/--md-primary:(#[\da-f]{6});/u)?.[1];
		const onPrimary = variables.match(/--md-on-primary:(#[\da-f]{6});/u)?.[1];
		assert.isDefined(primary);
		assert.isDefined(onPrimary);
		expect(
			Contrast.ratioOfTones(lstarFromArgb(argbFromHex(primary)), lstarFromArgb(argbFromHex(onPrimary))),
		).toBeGreaterThanOrEqual(ratio);
	});
});

test.each([false, true])('FrogLog uses readable green and blue accents (dark: %s)', (dark) => {
	const color = schemeColors(defaultThemeColor, dark, 'standard', 'froglog');
	const primary = Hct.fromInt(color('primary'));
	const secondary = Hct.fromInt(color('secondaryContainer'));
	expect(primary.hue).toBeGreaterThan(110);
	expect(primary.hue).toBeLessThan(150);
	expect(secondary.hue).toBeGreaterThan(210);
	expect(secondary.hue).toBeLessThan(260);
	expect(Contrast.ratioOfTones(primary.tone, lstarFromArgb(color('onPrimary')))).toBeGreaterThanOrEqual(4.5);
	expect(Contrast.ratioOfTones(secondary.tone, lstarFromArgb(color('onSecondaryContainer')))).toBeGreaterThanOrEqual(
		4.5,
	);
});

test('switching presets restores the chosen scheme', () => {
	const style = { textContent: '' };
	const setItem = vi.fn<(key: string, value: string) => void>();
	vi.stubGlobal('document', {
		querySelector: () => style,
	});
	vi.stubGlobal('localStorage', { setItem });

	applyThemeColor('#123456', 'custom', 'standard', 'default');
	const customCss = style.textContent;
	expect(customCss).toContain(themeColorVariables('#123456', false, 'standard', 'custom'));
	expect(customCss).toContain(themeColorVariables('#123456', true, 'standard', 'custom'));

	applyThemeColor('#123456', 'team581', 'standard', 'default');
	expect(style.textContent).toContain(themeColorVariables(defaultThemeColor, false, 'standard', 'team581'));
	expect(style.textContent).toContain(themeColorVariables(defaultThemeColor, true, 'standard', 'team581'));

	applyThemeColor('#123456', 'custom', 'standard', 'default');
	expect(style.textContent).toBe(customCss);
});

test.each(visualizationPalettes.filter((palette) => palette !== 'default'))(
	'%s changes only the five series colors, with contrast on light and dark surfaces',
	(palette) => {
		const style = { textContent: '' };
		vi.stubGlobal('document', { querySelector: () => style });
		vi.stubGlobal('localStorage', { setItem: () => {} });

		applyThemeColor(defaultThemeColor, 'team581', 'standard', palette);
		const themedCss = style.textContent;
		const seriesDeclaration = /--series-[1-5]:(#[\da-f]{6});/gu;
		for (const [index, dark] of [false, true].entries()) {
			const block = themedCss.split('}')[index]!;
			const colors = Array.from(block.matchAll(seriesDeclaration), ([, color]) => color!);
			expect(new Set(colors).size).toBe(5);
			for (const preset of themePresets) {
				const surface = lstarFromArgb(schemeColors(defaultThemeColor, dark, 'standard', preset)('surface'));
				for (const color of colors) {
					expect(Contrast.ratioOfTones(lstarFromArgb(argbFromHex(color)), surface)).toBeGreaterThanOrEqual(3);
				}
			}
		}

		applyThemeColor(defaultThemeColor, 'team581', 'standard', 'default');
		expect(themedCss.replaceAll(seriesDeclaration, '')).toBe(style.textContent);
	},
);

test.each([false, true])('deutan includes a neutral series color instead of another hue (dark: %s)', (dark) => {
	expect(seriesPaletteVariables('deutan', dark)).toMatch(/--series-[1-5]:#([\da-f]{2})\1\1;/u);
});

test.each(
	[false, true].flatMap((dark) =>
		(['standard', 'high'] as const).flatMap((contrast) =>
			['primary', 'secondary-container', 'surface', 'surface-container', 'outline-variant'].map(
				(role) => [dark, contrast, role] as const,
			),
		),
	),
)('neutral %s %s %s is untinted', (dark, contrast, role) => {
	// Equal red, green, and blue
	expect(themeColorVariables(defaultThemeColor, dark, contrast, 'neutral')).toMatch(
		new RegExp(`--md-${role}:#(\\w\\w)\\1\\1;`, 'u'),
	);
});

test('only the Team 581 preset previews muted surfaces for the maroon seed', () => {
	expect(themePreviewColors('team581', defaultThemeColor, true, 'standard')).toMatchObject({
		sidebar: '#161212',
		primary: '#f9b6b1',
	});
	expect(themePreviewColors('custom', defaultThemeColor, true, 'standard')).toMatchObject({
		sidebar: '#1a1110',
		primary: '#f9b6b1',
	});
});
