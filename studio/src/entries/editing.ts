import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
import * as z from 'zod';
import { isMobileLayout } from '@/lib/mobile-layout';
import { createPersistedAtom } from '@/lib/persisted-store';

const dockedOpenStore = createPersistedAtom('entry-browser-open', z.boolean(), true, { perWindow: true });
// Opening a full-screen panel on a phone shouldn't change the saved docked layout.
const mobileOpenStore = createAtom(false);

export function getEntryBrowserOpenStore(mobile = isMobileLayout()) {
	return mobile ? mobileOpenStore : dockedOpenStore;
}

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
	getEntryBrowserOpenStore().set(true);
	searchFocusStore.set((count) => count + 1);
}

export function setEntryBrowserOpen(open: boolean): void {
	if (!open) {
		editingStore.set(undefined);
	}
	getEntryBrowserOpenStore().set(open);
}

export function toggleEntryBrowser(): void {
	setEntryBrowserOpen(!getEntryBrowserOpenStore().get());
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
	const open = getEntryBrowserOpenStore().get();
	editingStore.set({ dashboardId, paneId, opened: current ? current.opened : !open });
	focusEntrySearch();
}

export function stopEditing(): void {
	if (editingStore.get()?.opened === true) {
		getEntryBrowserOpenStore().set(false);
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
