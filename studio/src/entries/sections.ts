import * as z from 'zod';
import type { MenuEntry } from '@/components/app-context-menu';
import { createPersistedAtom } from '@/lib/persisted-store';

/** Where an entry or group is shown in the entry browser. `active` lists the edited widget's entries again, see `ActiveSection`. */
export type EntrySection = 'active' | 'pinned' | 'main' | 'hidden';

export type EntryPlacements = Readonly<Record<string, 'pinned' | 'hidden'>>;

/** Paths of the pinned and hidden entries and groups, saved for every source since logs from the same robot share names */
export const entryPlacementsStore = createPersistedAtom<EntryPlacements>(
	'entry-placements',
	z.record(z.string(), z.enum(['pinned', 'hidden'])),
	{},
);

/** Pin, hide, or restore an entry or group, `main` restores it */
export function moveToSection(path: string, section: Exclude<EntrySection, 'active'>): void {
	entryPlacementsStore.set(({ [path]: _previous, ...others }) =>
		section === 'main' ? others : { ...others, [path]: section },
	);
}

/**
 * Pin and hide actions for a row in `section`. Entries and groups in a pinned or hidden group are moved with it,
 * so they can only be moved to the other section.
 */
export function sectionMenuItems(path: string, section: EntrySection): MenuEntry[] {
	const placement = entryPlacementsStore.get()[path];
	const items: MenuEntry[] = [];
	if (placement === 'pinned') {
		items.push({ label: 'Unpin', onSelect: () => moveToSection(path, 'main') });
	} else if (section !== 'pinned') {
		items.push({ label: 'Pin', onSelect: () => moveToSection(path, 'pinned') });
	}
	if (placement === 'hidden') {
		items.push({ label: 'Unhide', onSelect: () => moveToSection(path, 'main') });
	} else if (section !== 'hidden') {
		items.push({ label: 'Hide', onSelect: () => moveToSection(path, 'hidden') });
	}
	return items;
}
