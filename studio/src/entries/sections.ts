import * as z from 'zod';
import { createPersistedAtom } from '@/lib/persisted-store';

/** Where an entry or group is shown in the entry browser */
export type EntrySection = 'pinned' | 'main' | 'hidden';

export type EntryPlacements = Readonly<Record<string, 'pinned' | 'hidden'>>;

/** Paths of the pinned and hidden entries and groups, saved for every source since logs from the same robot share names */
export const entryPlacementsStore = createPersistedAtom<EntryPlacements>(
	'entry-placements',
	z.record(z.string(), z.enum(['pinned', 'hidden'])),
	{},
);

/** Pin, hide, or restore an entry or group, `main` restores it */
export function moveToSection(path: string, section: EntrySection): void {
	entryPlacementsStore.set(({ [path]: _previous, ...others }) =>
		section === 'main' ? others : { ...others, [path]: section },
	);
}
