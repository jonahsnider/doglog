import { themePalette } from '@astryxdesign/core/palette';
import { defineTheme } from '@astryxdesign/core/theme';
import { doglogSeeds } from '@/theme/doglog-colors';

/**
 * Content on the inverted surface, like toasts, is Astryx's on-dark or on-light color. Fills and borders there are made
 * from it too, since the theme's own neutrals don't switch with the surface.
 */
function invertedTokens(surface: 'dark' | 'light'): Record<string, string> {
	const content = `var(--color-on-${surface})`;
	const alpha = (percent: number) => `color-mix(in srgb, ${content} ${percent}%, transparent)`;
	return {
		'--color-text-secondary': content,
		'--color-icon-secondary': content,
		'--color-neutral': alpha(16),
		'--color-border': alpha(16),
		'--color-overlay-hover': alpha(8),
		'--color-overlay-pressed': alpha(10),
	};
}

/** DogLog's Astryx theme */
export const doglogTheme = defineTheme({
	name: 'doglog',
	palette: themePalette(doglogSeeds),
	typography: {
		scale: { base: 14, ratio: 1.2 },
		body: { family: 'IBM Plex Sans Variable', fallbacks: 'system-ui, sans-serif' },
		heading: { family: 'Source Sans 3 Variable', fallbacks: 'system-ui, sans-serif', weight: 'semibold' },
		code: { family: 'IBM Plex Mono', fallbacks: 'ui-monospace, monospace' },
	},
	tokens: {
		// Only Spinner reads it, for one turn a second instead of Astryx's quicker spin
		'--duration-slow-min': '1000ms',

		'--radius-inner': '6px',
		'--radius-element': '8px',
		'--radius-container': '10px',
		'--radius-page': '14px',
	},
	// Tooltips paint the inverted surface with surface-colored text, but leave the secondary colors for the normal surface
	components: {
		tooltip: {
			base: {
				'--color-text-secondary': 'color-mix(in srgb, var(--color-background-surface) 72%, transparent)',
				'--color-icon-secondary': 'color-mix(in srgb, var(--color-background-surface) 72%, transparent)',
				'--color-border': 'color-mix(in srgb, var(--color-background-surface) 16%, transparent)',
			},
		},
	},
	// Bigger controls for fingers, so touch targets come from the theme instead of each control
	adaptations: {
		rules: [
			{
				when: { pointer: 'coarse' },
				value: { tokens: { '--size-element-sm': '36px', '--size-element-md': '40px', '--size-element-lg': '44px' } },
			},
		],
	},
	onDark: { tokens: invertedTokens('dark') },
	onLight: { tokens: invertedTokens('light') },
});
