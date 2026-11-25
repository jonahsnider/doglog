import * as stylex from '@stylexjs/stylex';

/** A pane, whose controls show while it's hovered */
export const paneMarker: ReturnType<typeof stylex.defineMarker> = stylex.defineMarker();

/** A pane's title, which shows a move icon while it's hovered or dragged */
export const paneTitleMarker: ReturnType<typeof stylex.defineMarker> = stylex.defineMarker();
