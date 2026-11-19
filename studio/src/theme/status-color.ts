import { Blend, TonalPalette, argbFromHex, hexFromArgb } from '@material/material-color-utilities';

/**
 * Status colors keep their meaning, so like MD3 custom colors they start from a fixed hue that's only nudged toward the theme
 * color's. Warning isn't nudged, like MD3's error: amber turns orange next to red themes, close to the error color, and
 * chartreuse next to green or blue ones.
 */
const statuses = ['success', 'info', 'warning', 'test-mode'] as const;
export type Status = (typeof statuses)[number];
const statusColors: Record<Status, string> = {
	success: '#10b981',
	info: '#3b82f6',
	warning: '#f59e0b',
	'test-mode': '#8b5cf6',
};

export function statusPalette(status: Status, themeColor: string): TonalPalette {
	const color = argbFromHex(statusColors[status]);
	return TonalPalette.fromInt(status === 'warning' ? color : Blend.harmonize(color, argbFromHex(themeColor)));
}

/**
 * Generate status colors for a theme color as CSS variable declarations, ex. `--success` for fills and icons and
 * `--success-foreground` for text. Warning fills are lighter since yellows only look yellow when they're light.
 */
export function statusColorVariables(themeColor: string, dark: boolean): string {
	return statuses
		.map((status) => {
			const palette = statusPalette(status, themeColor);
			const fillTone = status === 'warning' ? 75 : dark ? 70 : 60;
			const fill = `--${status}:${hexFromArgb(palette.tone(fillTone))};`;
			return status === 'test-mode'
				? fill
				: `${fill}--${status}-foreground:${hexFromArgb(palette.tone(dark ? 80 : 40))};`;
		})
		.join('');
}
