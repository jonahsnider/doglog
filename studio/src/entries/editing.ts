import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
import * as z from 'zod';
import { createPersistedAtom } from '@/lib/persisted-store';

export const entryBrowserOpenStore = createPersistedAtom('entry-browser-open', z.boolean(), true, { perWindow: true });

type Editing = {
	dashboardId: string;
	paneId: string;
	/** The entry browser was opened to edit, so it's collapsed again after */
	opened: boolean;
};

/** Not persisted, editing is something the user is in the middle of */
const editingStore = createAtom<Editing | undefined>(undefined);

/** Counts requests to focus the entry browser's search box, which focuses it when this changes */
export const searchFocusStore = createAtom(0);

export function focusEntrySearch(): void {
	entryBrowserOpenStore.set(true);
	searchFocusStore.set((count) => count + 1);
}

export function toggleEntryBrowser(): void {
	if (entryBrowserOpenStore.get()) {
		editingStore.set(undefined);
	}
	entryBrowserOpenStore.set((open) => !open);
}

/** The pane whose widget's entries are being edited */
export function useEditing(): Pick<Editing, 'dashboardId' | 'paneId'> | undefined {
	return useSelector(editingStore);
}

export function useEditingPane(dashboardId: string, paneId: string): boolean {
	return useSelector(editingStore, (editing) => editing?.dashboardId === dashboardId && editing.paneId === paneId);
}

export function startEditing(dashboardId: string, paneId: string): void {
	const current = editingStore.get();
	const open = entryBrowserOpenStore.get();
	editingStore.set({ dashboardId, paneId, opened: current ? current.opened : !open });
	focusEntrySearch();
}

export function stopEditing(): void {
	if (editingStore.get()?.opened === true) {
		entryBrowserOpenStore.set(false);
	}
	editingStore.set(undefined);
}

export function toggleEditing(dashboardId: string, paneId: string): void {
	const current = editingStore.get();
	if (current?.dashboardId === dashboardId && current.paneId === paneId) {
		stopEditing();
	} else {
		startEditing(dashboardId, paneId);
	}
}

/**
 * While editing, focusing another pane edits its widget's entries instead, or stops if its widget doesn't take entries.
 * Pressing a pane's Edit entries button (marked with `data-edit-entries`) is left to the button.
 */
export function focusEditingPane(
	dashboardId: string,
	paneId: string,
	bindsEntries: boolean,
	target: EventTarget,
): void {
	const current = editingStore.get();
	if (
		current === undefined ||
		(current.dashboardId === dashboardId && current.paneId === paneId) ||
		(target instanceof Element && target.closest('[data-edit-entries]'))
	) {
		return;
	}
	if (bindsEntries) {
		editingStore.set({ ...current, dashboardId, paneId });
	} else {
		stopEditing();
	}
}
