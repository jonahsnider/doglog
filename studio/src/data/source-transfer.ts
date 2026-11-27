// Moving sources between desktop windows, see `@/desktop/source-windows`
import type { DataSetTransfer } from '@/data/data-set';
import { createDataSet, liveTime } from '@/data/data-store';
import { nameDevices } from '@/data/device-names';
import { loadLog } from '@/data/log-source';
import type { RestoredLog } from '@/data/log-worker';
import { claimRecording, closeLiveRecording } from '@/data/recording';
import { connectToHost } from '@/data/source';
import { lineUpLog, lineUpWithLatestEnable, setLiveLineUp } from '@/data/source-line-up';
import {
	type LiveSource,
	type LogSource,
	type Source,
	sourceData,
	sourcesStore,
	sourceState,
	updateSources,
} from '@/data/source-store';
import { createId } from '@/lib/random-id';

/** A source copied to move it to another window, see `@/desktop/source-windows` */
export type SourceTransfer =
	| { type: 'log'; log: LogSource; data: DataSetTransfer }
	| { type: 'live'; live: LiveSource; data: DataSetTransfer };

/** Copy a source to move it to another window */
export function transferSource(source: Source): SourceTransfer | undefined {
	const data = sourceData(source)?.toTransfer();
	if (data === undefined || source.status === 'loading') {
		return undefined;
	}
	return source.type === 'log' ? { type: 'log', log: source, data } : { type: 'live', live: source, data };
}

/** Whether this window can take a source from another window, it only has room for one live session */
export function canAdopt(type: Source['type']): boolean {
	return type === 'log' || sourcesStore.get().live === undefined;
}

/**
 * Add a log another window moved here, at `index` among the logs. A window that already has sources lines it up with
 * them, otherwise it keeps its offset.
 */
export function adoptLog({ log, data: transfer }: { log: LogSource; data: DataSetTransfer }, index?: number): string {
	const id = createId();
	const data = createDataSet();
	data.addTransfer(transfer);
	sourceState.logData.set(id, data);
	nameDevices(data);
	data.publish();
	const { logs, live } = sourcesStore.get();
	const lineUp = logs.length > 0 || live !== undefined;
	const adopted: LogSource = { ...log, id, ...(lineUp && { manualOffset: undefined }) };
	updateSources({ logs: logs.toSpliced(index ?? logs.length, 0, adopted) });
	if (lineUp && log.manualOffset !== true) {
		lineUpLog(id);
	}
	return id;
}

/** Stop the live session to move it to another window, keeping its recording for that window. Returns the recording's ID. */
export function detachLive(): Promise<string | undefined> {
	sourceState.liveGeneration++;
	sourceState.stopLive?.();
	sourceState.stopLive = undefined;
	sourceState.liveData = undefined;
	updateSources({ live: undefined });
	return closeLiveRecording();
}

/**
 * Add a live session another window moved here. It reconnects once `recording`, the session's recording, can be
 * continued, see `continueLive()`.
 */
export function adoptLive({ live, data: transfer }: { live: LiveSource; data: DataSetTransfer }): boolean {
	if (sourcesStore.get().live !== undefined) {
		return false;
	}
	sourceState.liveGeneration++;
	const data = createDataSet();
	data.addTransfer(transfer);
	data.trimHistory();
	data.publish();
	sourceState.liveData = data;
	setLiveLineUp('enable');
	const status = live.status === 'disconnected' ? 'disconnected' : 'reconnecting';
	updateSources({ live: { ...live, status } });
	lineUpWithLatestEnable(false);
	return true;
}

/** Continue the recording of a live session another window moved here, then reconnect it unless it was disconnected */
export async function continueLive(recordingId: string | undefined): Promise<void> {
	const live = sourcesStore.get().live;
	const generation = sourceState.liveGeneration;
	if (recordingId !== undefined) {
		const claimed = await claimRecording(recordingId).catch(() => undefined);
		const restored = await new Promise<RestoredLog | undefined>((resolve) => {
			if (claimed === undefined) {
				resolve(undefined);
				return;
			}
			// Read again only for where to continue writing it, the data came from the other window
			loadLog(
				claimed.file,
				createDataSet(),
				{
					onProgress: () => {},
					onLoaded: (_unread, read) => resolve(read),
					onError: () => resolve(undefined),
				},
				{ live: true },
			);
		});
		if (sourceState.liveGeneration !== generation || sourcesStore.get().live === undefined) {
			claimed?.release();
			return;
		}
		if (claimed !== undefined && restored !== undefined) {
			const recording = claimed.continue(restored);
			if (restored.connected) {
				recording.record({ type: 'status', status: 'reconnecting', liveTime: liveTime() });
			}
		} else {
			claimed?.release();
		}
	}
	if (live !== undefined && live.status !== 'disconnected') {
		void connectToHost(live.host, 'reconnecting');
	}
}
