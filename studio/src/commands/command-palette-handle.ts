import { createAtom } from '@tanstack/store';

/** Whether the command palette is open, kept apart from it so the sidebar and menu bar can open it */
export const commandPaletteOpen = createAtom(false);

export function toggleCommandPalette(): void {
	commandPaletteOpen.set((open) => !open);
}
