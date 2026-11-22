// The video widgets' state that isn't saved with the dashboard: which ones are being synced, and which are muted
import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
import * as z from 'zod';
import { createPersistedAtom } from '@/lib/persisted-store';

/** How far (s) frame steps and nudges move a video, one frame at 30 fps */
export const frameLength = 1 / 30;

/**
 * Panes whose video is being synced, with the time (s) Sync mode starts the video at, `undefined` to start where the
 * video is lined up with the cursor
 */
const syncingStore = createAtom<Readonly<Record<string, { start: number | undefined }>>>({});

export function useSyncing(paneId: string): { start: number | undefined } | undefined {
	return useSelector(syncingStore, (syncing) => syncing[paneId]);
}

/** Start syncing a pane's video, at `start` (s) in the video */
export function startSyncing(paneId: string, start?: number): void {
	syncingStore.set((syncing) => ({ ...syncing, [paneId]: { start } }));
}

export function stopSyncing(paneId: string): void {
	syncingStore.set((syncing) => Object.fromEntries(Object.entries(syncing).filter(([id]) => id !== paneId)));
}

// Panes the user unmuted, videos start muted so scrubbing doesn't play the match's audio
const unmutedStore = createPersistedAtom('video-unmuted', z.array(z.string()).catch([]), []);

export function useMuted(paneId: string): boolean {
	return useSelector(unmutedStore, (unmuted) => !unmuted.includes(paneId));
}

export function setMuted(paneId: string, muted: boolean): void {
	unmutedStore.set((unmuted) => [...unmuted.filter((other) => other !== paneId), ...(muted ? [] : [paneId])]);
}
