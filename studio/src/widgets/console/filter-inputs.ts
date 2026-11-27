import { createAtom } from '@tanstack/store';

/** Only mounted Console filters register here; a pane showing No data has no filter to focus. */
export const consoleFilterInputs = createAtom<ReadonlyMap<string, HTMLInputElement>>(new Map());
