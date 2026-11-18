// Theme choices from Settings, apart from the color code so agent command schemas can use them in Node, see `@/agent`

export const themes = ['light', 'dark', 'system'] as const;
export type Theme = (typeof themes)[number];

export const themePresets = ['team581', 'match13', 'coss', 'custom'] as const;
export type ThemePreset = (typeof themePresets)[number];

export const contrasts = ['standard', 'medium', 'high'] as const;
export type Contrast = (typeof contrasts)[number];

/** Number of `--chart-*` colors, spaced evenly around the hue wheel starting from the theme color's hue */
export const chartCount = 5;
