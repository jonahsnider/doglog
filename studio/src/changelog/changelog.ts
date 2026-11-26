import { useSelector } from '@tanstack/react-store';
import * as z from 'zod';
import { createPersistedAtom } from '@/lib/persisted-store';

/** The newest product update, shown in the sidebar. Increment `id` when changing it so it's shown again. */
const update = {
	id: 9,
	title: 'View multiple logs',
	description:
		'Studio can now open several logs at once to analyze side-by-side.',
};

/** ID of the update the user dismissed. New users start caught up, so they only see updates made after they started. */
const seenStore = createPersistedAtom('changelog-seen', z.int(), update.id);

export function useUnseenUpdate(): typeof update | undefined {
	return useSelector(seenStore) < update.id ? update : undefined;
}

export function dismissUpdate(): void {
	seenStore.set(update.id);
}
