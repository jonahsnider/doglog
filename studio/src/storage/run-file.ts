// Writes a run's `doglog.json` when its log is uploaded, see the log-storage spec's run file
import { teamDefaultsStore } from '@/cloud/session';
import { settingsStore } from '@/settings';
import { StorageError, type StorageClient } from '@/storage/client';
import { encodeJson, isoWithOffset, runFileName, runFileSchema } from '@/storage/format';
import type { LogSummary } from '@/storage/summary-worker';
import { parseLogName } from '@/sync/log-names';
import { compareRunLogs } from '@/sync/runs';

/** Work out a log's duration and whether it has auto and teleop, off the main thread */
export function summarizeLog(contents: ArrayBuffer): Promise<LogSummary> {
	const worker = new Worker(new URL('./summary-worker.ts', import.meta.url), { type: 'module' });
	return new Promise<LogSummary>((resolve, reject) => {
		worker.addEventListener('message', ({ data }: MessageEvent<LogSummary | { error: string }>) => {
			if ('error' in data) {
				reject(new Error(data.error));
			} else {
				resolve(data);
			}
		});
		worker.addEventListener('error', (event) => reject(new Error(event.message)));
		worker.postMessage(contents, [contents]);
	}).finally(() => worker.terminate());
}

function teamNumber(): number | undefined {
	const target = settingsStore.get().robotTarget.trim();
	return /^\d+$/u.test(target) ? Number(target) : (teamDefaultsStore.get()?.teamNumber ?? undefined);
}

async function readJson(storage: StorageClient, path: string): Promise<unknown> {
	try {
		return JSON.parse(new TextDecoder().decode(await storage.read(path)));
	} catch (error) {
		// No run file yet
		if (error instanceof StorageError && (error.status === 404 || error.message.includes("doesn't exist"))) {
			return {};
		}
		throw error;
	}
}

/**
 * Add a log to its run's `doglog.json`, filling in what its name says and, for a robot log, its summary.
 * Keeps fields Studio doesn't know, and values another tool already wrote that Studio can't tell from the log.
 */
export async function addToRunFile(
	storage: StorageClient,
	folder: string,
	logName: string,
	summary: LogSummary | undefined,
): Promise<void> {
	const path = folder === '' ? runFileName : `${folder}/${runFileName}`;
	const existing = runFileSchema.parse(await readJson(storage, path));
	const logs = [...new Set([...existing.logs, logName])].toSorted((a, b) => compareRunLogs({ name: a }, { name: b }));

	const parsed = logs.map((name) => parseLogName(name)).filter((name) => name !== undefined);
	const robotLog = parsed.find((name) => name.canBus === undefined) ?? parsed[0];
	const start = Math.min(...parsed.map((name) => name.date.getTime()));
	const matchParts = robotLog?.match?.label.split(' ');
	const match = matchParts?.pop();
	const event = matchParts !== undefined && matchParts.length > 0 ? matchParts.join(' ') : robotLog?.event;

	const next = {
		...existing,
		version: 1,
		start: Number.isFinite(start) ? isoWithOffset(new Date(start)) : existing.start,
		...summary,
		event: event ?? existing.event,
		match: match ?? existing.match,
		team: existing.team ?? teamNumber(),
		logs,
	};
	await storage.write(path, encodeJson(next), 'application/json');
}
