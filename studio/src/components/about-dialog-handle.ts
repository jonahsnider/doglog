import { createAtom } from '@tanstack/store';

/** Whether the About dialog is open, kept apart from the dialog so the app menu can open it */
export const aboutDialogOpen = createAtom(false);
