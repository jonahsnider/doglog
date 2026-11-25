import * as stylex from '@stylexjs/stylex';

/** The entry browser, whose indent guides show while it's hovered */
export const entryBrowserMarker: ReturnType<typeof stylex.defineMarker> = stylex.defineMarker();

/** A row of the entry tree, whose actions and checkbox show while it's hovered or focused */
export const entryRowMarker: ReturnType<typeof stylex.defineMarker> = stylex.defineMarker();

/** An entry's name, which shows its shortened segments in full while its common prefix is hovered */
export const entryNameMarker: ReturnType<typeof stylex.defineMarker> = stylex.defineMarker();

/** The common prefix of an entry's name, shown in full while hovered */
export const commonPrefixMarker: ReturnType<typeof stylex.defineMarker> = stylex.defineMarker();

/** A shortened segment of an entry's name, shown in full while hovered */
export const nameSegmentMarker: ReturnType<typeof stylex.defineMarker> = stylex.defineMarker();

/** The entry search box, whose shortcut gives way once it's focused */
export const entrySearchMarker: ReturnType<typeof stylex.defineMarker> = stylex.defineMarker();
