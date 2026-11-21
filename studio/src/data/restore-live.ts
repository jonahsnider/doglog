import { createDataSet } from '@/data/data-store';
import { loadLog } from '@/data/log-source';
import { claimRecording } from '@/data/recording';
import { restoreLiveSession } from '@/data/source';

/**
 * Restore the live session from the recording that changed most recently that no other tab or window uses, ex. after
 * Studio closed or crashed. Nothing changes if a live session was started first.
 */
export async function restoreLive(): Promise<void> {
	// Ex. the browser has no private file system for the page, since it's served over HTTP
	const claimed = await claimRecording().catch(() => undefined);
	if (claimed === undefined) {
		return;
	}

	const data = createDataSet();
	loadLog(
		claimed.file,
		data,
		{
			onProgress: () => {},
			onLoaded: (_unread, restored) => {
				if (restored === undefined) {
					// Not a recording Studio can continue
					claimed.delete();
					return;
				}
				data.trimHistory();
				data.disconnect(restored.disconnectedAt);
				if (!restoreLiveSession(data, restored)) {
					// Left for another window, or this one to restore later
					claimed.release();
					return;
				}
				// Before the session reconnects, which waits for the NT4 client to load
				const recording = claimed.continue(restored);
				if (restored.connected) {
					// Studio closed without noting it disconnected
					recording.record({ type: 'status', status: 'reconnecting', liveTime: restored.disconnectedAt });
				}
			},
			onError: () => claimed.delete(),
		},
		true,
	);
}
