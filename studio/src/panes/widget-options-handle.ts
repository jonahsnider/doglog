import { createAtom } from '@tanstack/store';

/** The pane whose widget options are open, kept apart from them so the command palette can open them */
export const widgetOptionsPane = createAtom<string | undefined>(undefined);
