import { useSelector } from '@tanstack/react-store';
import * as z from 'zod';
import { createPersistedAtom } from '@/lib/persisted-store';

/** The newest product update, shown in the sidebar. Increment `id` when changing it so it's shown again. */
const update = {
	id: 9,
	title: 'Compare logs',
	description:
		'Open several logs at once, or a log alongside the robot, and every widget draws them together, lined up by when the robot was enabled.',
};

/** ID of the update the user dismissed. New users start caught up, so they only see updates made after they started. */
const seenStore = createPersistedAtom('changelog-seen', z.int(), update.id);

export function useUnseenUpdate(): typeof update | undefined {
	return useSelector(seenStore) < update.id ? update : undefined;
}

export function dismissUpdate(): void {
	seenStore.set(update.id);
}
