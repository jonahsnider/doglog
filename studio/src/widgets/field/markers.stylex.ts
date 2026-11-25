import * as stylex from '@stylexjs/stylex';

/** The field widget, so the controls under it can hide while it isn't hovered or focused */
export const fieldMarker: ReturnType<typeof stylex.defineMarker> = stylex.defineMarker();
