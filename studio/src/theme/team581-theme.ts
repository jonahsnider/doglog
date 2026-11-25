import { defineTheme } from '@astryxdesign/core/theme';

/**
 * Team 581's maroon Material 3 scheme, light and dark: Tonal Spot (2025) seeded with #591616, with muted neutral
 * palettes so surfaces stay close to neutral and the maroon carries emphasis. Status colors are fixed hues nudged toward
 * the maroon, apart from warning. Only the roles the Astryx tokens below use.
 */
export const team581Palette = {
	primary: ['#8c4d4a', '#f9b6b1'],
	'on-primary': ['#fff7f6', '#613331'],
	'secondary-container': ['#ffdad7', '#503432'],
	surface: ['#fef8f7', '#100d0d'],
	'surface-dim': ['#e0d8d7', '#100d0d'],
	'surface-container-lowest': ['#ffffff', '#000000'],
	'surface-container-low': ['#f9f2f1', '#161212'],
	'surface-container': ['#f3eceb', '#1d1918'],
	'surface-container-highest': ['#e8e1e0', '#2a2424'],
	'inverse-surface': ['#0f0e0e', '#fff8f7'],
	scrim: ['#000000', '#000000'],
	'on-surface': ['#353231', '#eee3e2'],
	'on-surface-variant': ['#635e5d', '#b3a9a8'],
	outline: ['#7f7979', '#7c7373'],
	'outline-variant': ['#b7b0b0', '#4d4646'],
	error: ['#a73b21', '#f97758'],
	'on-error': ['#fff7f6', '#450900'],
	'error-container': ['#fd795a', '#85230a'],
	'on-error-container': ['#6e1400', '#ff9b82'],
	success: ['#40a455', '#5cbf6d'],
	'success-foreground': ['#006e2b', '#78dc86'],
	info: ['#7885ff', '#9ba4ff'],
	'info-foreground': ['#4250ce', '#bdc2ff'],
	warning: ['#fea619', '#fea619'],
	'warning-foreground': ['#855300', '#ffb95f'],
} as const satisfies Record<string, readonly [string, string]>;

export type Team581Role = keyof typeof team581Palette;

/**
 * Astryx color tokens from Material 3 roles, given each role's color in light (`dark` false) and dark mode. Apps that
 * generate their own scheme map the same roles to it, ex. as CSS variables.
 */
export function team581ColorTokens(
	color: (role: Team581Role, dark: boolean) => string,
): Record<string, string | [string, string]> {
	const role = (name: Team581Role) => (dark: boolean) => color(name, dark);
	/** A state layer or disabled color: the role at one of MD3's opacities */
	const alpha = (name: Team581Role, percent: number) => (dark: boolean) =>
		`color-mix(in srgb, ${color(name, dark)} ${percent}%, transparent)`;

	const tokens: Record<string, (dark: boolean) => string> = {
		'--color-accent': role('primary'),
		'--color-on-accent': role('on-primary'),
		// Selected items are secondary container, like MD3's navigation drawer
		'--color-accent-muted': role('secondary-container'),
		'--color-text-accent': role('primary'),
		'--color-icon-accent': role('primary'),
		'--focus-outline-color': role('primary'),

		// Content is surface and the frame around it is surface dim. Dark schemes' surface dim matches surface, so the frame
		// uses the only darker role there.
		'--color-background-body': (dark) => color(dark ? 'surface-container-lowest' : 'surface-dim', dark),
		'--color-background-surface': role('surface'),
		'--color-background-card': role('surface-container-low'),
		'--color-background-popover': role('surface-container'),
		'--color-background-muted': role('surface-container-highest'),
		'--color-background-inverted': role('inverse-surface'),
		'--color-neutral': role('surface-container-highest'),
		'--color-overlay': alpha('scrim', 32),
		'--color-overlay-hover': alpha('on-surface', 8),
		'--color-overlay-pressed': alpha('on-surface', 10),
		'--color-skeleton': role('surface-container-highest'),
		'--color-track': role('secondary-container'),

		'--color-text-primary': role('on-surface'),
		'--color-text-secondary': role('on-surface-variant'),
		'--color-text-disabled': alpha('on-surface', 38),
		'--color-icon-primary': role('on-surface'),
		'--color-icon-secondary': role('on-surface-variant'),
		'--color-icon-disabled': alpha('on-surface', 38),

		'--color-border': role('outline-variant'),
		// Controls with nothing inside them to see them by, like text fields and checkboxes, are bounded with outline
		'--color-border-emphasized': role('outline'),

		'--color-error': role('error'),
		'--color-on-error': role('on-error'),
		// Muted status fills are tints like the other statuses, since the generated error container is a saturated orange
		'--color-error-muted': alpha('error', 16),
		'--color-on-error-muted': role('on-error-container'),
		'--color-text-error': role('error'),
		'--color-background-error-inverted': role('error'),

		'--color-success': role('success'),
		'--color-text-success': role('success-foreground'),
		'--color-success-muted': alpha('success', 16),
		'--color-on-success-muted': role('success-foreground'),
		'--color-info': role('info'),
		'--color-text-info': role('info-foreground'),
		'--color-info-muted': alpha('info', 16),
		'--color-on-info-muted': role('info-foreground'),
		'--color-warning': role('warning'),
		'--color-text-warning': role('warning-foreground'),
		'--color-warning-muted': alpha('warning', 16),
		'--color-on-warning-muted': role('warning-foreground'),
	};
	return Object.fromEntries(
		Object.entries(tokens).map(([token, value]) => {
			const light = value(false);
			const dark = value(true);
			return [token, light === dark ? light : [light, dark]];
		}),
	);
}

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

/** Team 581's Astryx theme, shared by the team's apps */
export const team581Theme = defineTheme({
	name: 'team581',
	typography: {
		scale: { base: 14, ratio: 1.2 },
		body: { family: 'IBM Plex Sans Variable', fallbacks: 'system-ui, sans-serif' },
		heading: { family: 'Source Sans 3 Variable', fallbacks: 'system-ui, sans-serif', weight: 'semibold' },
		code: { family: 'IBM Plex Mono', fallbacks: 'ui-monospace, monospace' },
	},
	// Material 3 motion: standard, decelerate, and accelerate curves, with durations from Material's scale
	motion: { fast: 150, medium: 250, slow: 300, ratio: 0.75 },
	tokens: {
		'--ease-standard': 'cubic-bezier(0.2, 0, 0, 1)',
		'--ease-move': 'cubic-bezier(0.2, 0, 0, 1)',
		'--ease-entrance': 'cubic-bezier(0, 0, 0, 1)',
		'--ease-exit': 'cubic-bezier(0.3, 0, 1, 1)',
		'--duration-exit': '200ms',

		'--radius-inner': '6px',
		'--radius-element': '8px',
		'--radius-container': '10px',
		'--radius-page': '14px',

		...team581ColorTokens((role, dark) => team581Palette[role][dark ? 1 : 0]),
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
