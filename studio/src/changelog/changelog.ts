import { useSelector } from '@tanstack/react-store';
import * as z from 'zod';
import { createPersistedAtom } from '@/lib/persisted-store';

/** The newest product update, shown in the sidebar. Increment `id` when changing it so it's shown again. */
const update = {
	id: 1,
	title: 'Shared dashboards',
	description: 'Drag a dashboard into Shared to edit it with everyone connected to the robot in real-time.',
};

/** ID of the update the user dismissed. New users start caught up, so they only see updates made after they started. */
const seenStore = createPersistedAtom('changelog-seen', z.int(), update.id);

/** The newest update if the user hasn't dismissed it yet */
export function useUnseenUpdate(): typeof update | undefined {
	return useSelector(seenStore) < update.id ? update : undefined;
}

/** Hide the newest update */
export function dismissUpdate(): void {
	seenStore.set(update.id);
}
