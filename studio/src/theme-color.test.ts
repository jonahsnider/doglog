import { describe, expect, test } from 'vite-plus/test';
import css from './index.css?raw';
import { defaultThemeColor, themeColorVariables } from './theme-color.ts';

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
