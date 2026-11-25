import { createAtom } from '@tanstack/store';

/** Whether the Open log from URL dialog is open, kept apart from the dialog so commands can open it */
export const openLogUrlDialogOpen = createAtom(false);
