import { afterEach, describe, expect, test, vi } from 'vite-plus/test';
import css from './index.css?raw';
import { applyThemeColor, defaultThemeColor, themeColorVariables } from './theme-color.ts';

afterEach(() => {
	vi.unstubAllGlobals();
});

/** Get the `--md-*` declarations in a block of `index.css`, formatted like `themeColorVariables()` */
function cssVariables(block: string): string[] {
	return Array.from(
		block.matchAll(/(--md-[a-z-]+): rgb\((\d+) (\d+) (\d+)\);/gu),
		([, name, ...rgb]) => `${name}:#${rgb.map((channel) => Number(channel).toString(16).padStart(2, '0')).join('')}`,
	);
}

function generatedVariables(dark: boolean): string[] {
	return themeColorVariables(defaultThemeColor, dark).split(';').filter(Boolean);
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

	applyThemeColor('#123456', 'custom');
	const customCss = style.textContent;
	expect(customCss).toContain(themeColorVariables('#123456', false));
	expect(customCss).toContain(themeColorVariables('#123456', true));

	applyThemeColor('#123456', 'coss');
	expect(toggle).toHaveBeenLastCalledWith('coss-theme', true);
	expect(style.textContent).toBe('');
	expect(setItem).toHaveBeenLastCalledWith('doglog-studio:theme-color-css', '');

	applyThemeColor('#123456', 'team581');
	expect(toggle).toHaveBeenLastCalledWith('coss-theme', false);
	expect(style.textContent).toContain(themeColorVariables(defaultThemeColor, false));
	expect(style.textContent).toContain(themeColorVariables(defaultThemeColor, true));

	applyThemeColor('#123456', 'custom');
	expect(style.textContent).toBe(customCss);
});
