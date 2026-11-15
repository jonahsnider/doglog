import { addEntry, extendTimeRange, setStartTime } from '@/data/data-store';
import type { LogWorkerMessage } from '@/data/log-worker';
import { Samples } from '@/data/samples';

type LoadLogCallbacks = {
	onLoaded: (damaged: boolean) => void;
	onError: (message: string) => void;
};

/** Parse a WPILOG file in a worker and add its entries to the data store. Returns a function that cancels loading. */
export function loadLog(file: File, { onLoaded, onError }: LoadLogCallbacks): () => void {
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
			case 'entry':
				addEntry(message.name, message.entryType, new Samples(message.timestamps, message.values));
				break;
			case 'done':
				stop();
				if (message.start !== undefined && message.end !== undefined) {
					setStartTime(message.start);
					extendTimeRange(message.start, message.end);
				}
				onLoaded(message.damaged);
				break;
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
