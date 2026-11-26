import { createAtom } from '@tanstack/store';

/** Whether the Keyboard shortcuts dialog is open, kept apart from the dialog so the sidebar can open it */
export const keyboardShortcutsDialogOpen = createAtom(false);

export function toggleKeyboardShortcutsDialog(): void {
	keyboardShortcutsDialogOpen.set((open) => !open);
}
