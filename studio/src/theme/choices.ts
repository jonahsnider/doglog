// Theme choices from Settings, apart from the color code so agent command schemas can use them in Node, see `@/agent`

export const themes = ['light', 'dark', 'system'] as const;
export type Theme = (typeof themes)[number];

export const themePresets = ['team581', 'match13', 'froglog', 'neutral', 'custom'] as const;
export type ThemePreset = (typeof themePresets)[number];

export const contrasts = ['standard', 'medium', 'high'] as const;
export type Contrast = (typeof contrasts)[number];

export const visualizationPalettes = ['default', 'protan', 'deutan', 'tritan'] as const;
export type VisualizationPalette = (typeof visualizationPalettes)[number];

/** Number of colors in each series palette */
export const chartCount = 5;
