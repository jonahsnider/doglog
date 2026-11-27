import { parseHoot as readHoot } from 'hoot-parser';
import type { OnRecord, ParsedLog } from '@/data/parse-log';
import { createSamples, getEntryKind, isSchemaEntry, isStudioEntry, normalizeEntryName } from '@/data/samples';

/** Collect decoded HOOT records into Studio entries. */
export function parseHoot(bytes: Uint8Array, onProgress: (progress: number) => void, onRecord?: OnRecord): ParsedLog {
	const entries: ParsedLog['entries'] = new Map();
	const structSchemas: ParsedLog['structSchemas'] = new Map();
	const records = readHoot(bytes);
	let start: number | undefined;
	let end: number | undefined;
	let percent = 0;
	for (const record of records) {
		const nextPercent = Math.floor((records.bytesRead / bytes.length) * 100);
		if (nextPercent !== percent) {
			percent = nextPercent;
			onProgress(percent / 100);
		}
		if (record.kind === 'schema') {
			structSchemas.set(record.name, record.fields);
			continue;
		}
		const name = normalizeEntryName(record.name);
		if (isSchemaEntry(name) || isStudioEntry(name)) {
			continue;
		}
		const { type, unit, timestamp, payload } = record;
		onRecord?.(records.bytesRead, timestamp);
		let entry = entries.get(name);
		if (entry?.type !== type) {
			const metadata = unit === undefined || unit === '' ? '' : JSON.stringify({ unit });
			entry = { type, metadata, samples: createSamples(getEntryKind(type)) };
			entries.set(name, entry);
		}
		entry.samples.push(timestamp, payload);
		start = Math.min(start ?? timestamp, timestamp);
		end = Math.max(end ?? timestamp, timestamp);
	}
	if (start === undefined) {
		throw new Error('No supported signals could be read from this HOOT log.');
	}
	return {
		entries,
		structSchemas,
		start,
		end,
		unreadBytes: bytes.length - records.bytesRead,
		recording: undefined,
		openEntryIds: [],
		embeddedLogs: [],
	};
}
