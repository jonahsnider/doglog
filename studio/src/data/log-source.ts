import type { DataSet } from '@/data/data-set';
import { parseMetadata } from '@/data/data-store';
import type { LogWorkerMessage } from '@/data/log-worker';
import { Samples } from '@/data/samples';

/** The end of a log's file that couldn't be read */
export type UnreadEnd = {
	/** Percent of the file */
	percent: number;
	/** About how long it would have lasted (µs), at the rate the rest was logged */
	duration: number;
	/** When the readable part ends (µs since the log's start) */
	after: number;
};

type LoadLogCallbacks = {
	/** Called with the fraction of the log parsed, from 0 to 1 */
	onProgress: (progress: number) => void;
	/** `unread` is unset when the whole log was read, or all but a partial last record */
	onLoaded: (unread: UnreadEnd | undefined) => void;
	onError: (message: string) => void;
};

/** Parse a WPILOG file in a worker and add its entries to `data`. Returns a function that cancels loading. */
export function loadLog(file: File, data: DataSet, { onProgress, onLoaded, onError }: LoadLogCallbacks): () => void {
	const worker = new Worker(new URL('./log-worker.ts', import.meta.url), { type: 'module' });
	let stopped = false;

	const stop = () => {
		stopped = true;
		worker.terminate();
	};

	worker.addEventListener('message', (event: MessageEvent<LogWorkerMessage>) => {
		if (stopped) {
			return;
		}

		const message = event.data;
		switch (message.type) {
			case 'progress':
				onProgress(message.progress);
				break;
			case 'schemas':
				for (const [name, fields] of message.structSchemas) {
					data.addStructSchema(name, fields);
				}
				break;
			case 'entry':
				data.addEntry(
					message.name,
					message.entryType,
					new Samples(message.timestamps, message.values),
					parseMetadata(message.metadata),
				);
				break;
			case 'done': {
				stop();
				let unread: UnreadEnd | undefined;
				if (message.start !== undefined && message.end !== undefined) {
					data.setStartTime(message.start);
					data.extendTimeRange(message.start, message.end);
					// A partial last record is normal when the robot is turned off, and a little damage only loses about a second at the end
					if (message.unreadBytes > 64 * 1024) {
						const after = message.end - message.start;
						unread = {
							percent: Math.ceil((message.unreadBytes / file.size) * 100),
							duration: (message.unreadBytes / (file.size - message.unreadBytes)) * after,
							after,
						};
					}
				}
				onLoaded(unread);
				break;
			}
			case 'error':
				stop();
				onError(message.message);
				break;
		}
	});

	worker.addEventListener('error', (event) => {
		if (!stopped) {
			stop();
			onError(event.message);
		}
	});

	// oxlint-disable-next-line unicorn/require-post-message-target-origin -- Workers don't take a target origin
	worker.postMessage(file);

	return stop;
}
