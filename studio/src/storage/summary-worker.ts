// Works out what a run's `doglog.json` says about a log, off the main thread since the whole log is read
import { decompress } from '@/data/decompress';
import { parseLog } from '@/data/log-reader';
import type { ParsedLog } from '@/data/parse-log';
import { readModePeriods } from '@/data/robot-modes';
import { findEntry, getEntryKind } from '@/data/samples';
import { isXz } from '@/data/xz';

export interface LogSummary {
	/** Seconds from the log's first record to its last */
	duration: number;
	auto: boolean;
	teleop: boolean;
}

function summarize(parsed: ParsedLog): LogSummary {
	const { start, end } = parsed;
	if (start === undefined || end === undefined) {
		return { duration: 0, auto: false, teleop: false };
	}
	const entries = new Map(
		[...parsed.entries].map(([name, entry]) => [
			name,
			{ ...entry, name, kind: getEntryKind(entry.type), metadata: {} },
		]),
	);
	const periods = readModePeriods({ start, end }, (name) => findEntry(entries, name));
	return {
		duration: Math.round((end - start) / 1000) / 1000,
		auto: periods.some((period) => period.mode === 'auto'),
		teleop: periods.some((period) => period.mode === 'teleop'),
	};
}

self.addEventListener('message', ({ data }: MessageEvent<ArrayBuffer>) => {
	const read = async () => {
		const bytes = new Uint8Array(data);
		return summarize(parseLog(isXz(bytes) ? await decompress(bytes) : bytes, () => {}));
	};
	read().then(
		(summary) => postMessage(summary),
		(error: unknown) => postMessage({ error: String(error) }),
	);
});
