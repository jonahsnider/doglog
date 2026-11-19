import { Contrast, argbFromHex, lstarFromArgb } from '@material/material-color-utilities';
import { afterEach, assert, describe, expect, test, vi } from 'vite-plus/test';
import css from '../index.css?raw';
import {
	applyThemeColor,
	chartColorVariables,
	defaultThemeColor,
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

test('switching presets clears stale generated colors and restores the chosen scheme', () => {
	const style = { textContent: '' };
	const toggle = vi.fn<(name: string, force: boolean) => void>();
	const setItem = vi.fn<(key: string, value: string) => void>();
	vi.stubGlobal('document', {
		documentElement: { classList: { toggle } },
		querySelector: () => style,
	});
	vi.stubGlobal('localStorage', { setItem });

	applyThemeColor('#123456', 'custom', 'standard');
	const customCss = style.textContent;
	expect(customCss).toContain(themeColorVariables('#123456', false, 'standard', 'custom'));
	expect(customCss).toContain(themeColorVariables('#123456', true, 'standard', 'custom'));

	applyThemeColor('#123456', 'coss', 'standard');
	expect(toggle).toHaveBeenLastCalledWith('coss-theme', true);
	expect(style.textContent).toBe('');
	expect(setItem).toHaveBeenLastCalledWith('doglog-studio:theme-color-css', '');

	applyThemeColor('#123456', 'team581', 'standard');
	expect(toggle).toHaveBeenLastCalledWith('coss-theme', false);
	expect(style.textContent).toContain(themeColorVariables(defaultThemeColor, false, 'standard', 'team581'));
	expect(style.textContent).toContain(themeColorVariables(defaultThemeColor, true, 'standard', 'team581'));

	applyThemeColor('#123456', 'custom', 'standard');
	expect(style.textContent).toBe(customCss);
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
