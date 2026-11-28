import { expect, test } from 'vite-plus/test';
import { DataLogWriter } from 'wpilog-parser';
import { parseLog } from '@/data/log-reader';
import { StreamingLogParser } from '@/data/stream-log';
import { syntheticLog } from '@/data/synthetic-log';

const log = syntheticLog(64 * 1024);

function streamInChunks(bytes: Uint8Array, chunkSize: number) {
	const parser = new StreamingLogParser();
	for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
		parser.push(bytes.subarray(offset, Math.min(offset + chunkSize, bytes.byteLength)));
	}
	return parser.finish();
}

test.each([1, 7, 137, 4096])('StreamingLogParser matches parseLog with %i-byte chunks', (chunkSize) => {
	const expected = parseLog(log, () => {});
	const actual = streamInChunks(log, chunkSize);

	expect(actual.start).toBe(expected.start);
	expect(actual.end).toBe(expected.end);
	expect(actual.unreadBytes).toBe(expected.unreadBytes);
	expect([...actual.structSchemas.keys()]).toEqual([...expected.structSchemas.keys()]);
	expect([...actual.entries.keys()]).toEqual([...expected.entries.keys()]);
	for (const [name, entry] of expected.entries) {
		const streamed = actual.entries.get(name)!;
		expect(streamed.type).toBe(entry.type);
		expect(streamed.metadata).toBe(entry.metadata);
		expect(streamed.samples.timestamps).toEqual(entry.samples.timestamps);
		expect(streamed.samples.values()).toEqual(entry.samples.values());
	}
});

const encoder = new TextEncoder();

function concatBytes(parts: Uint8Array[]): Uint8Array {
	const out = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0));
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.byteLength;
	}
	return out;
}

function makeRecord(entryId: number, timestamp: bigint, payload: Uint8Array): Uint8Array {
	const bytes = new Uint8Array(11 + payload.length);
	bytes.set([0x70, entryId, payload.length]);
	new DataView(bytes.buffer).setBigInt64(3, timestamp, true);
	bytes.set(payload, 11);
	return bytes;
}

function makeStartPayload(entryId: number, name: string, type: string): Uint8Array {
	const parts = [name, type, ''].map((text) => encoder.encode(text));
	const bytes = new Uint8Array(5 + parts.reduce((sum, part) => sum + 4 + part.length, 0));
	const view = new DataView(bytes.buffer);
	view.setUint32(1, entryId, true);
	let offset = 5;
	for (const part of parts) {
		view.setUint32(offset, part.length, true);
		bytes.set(part, offset + 4);
		offset += 4 + part.length;
	}
	return bytes;
}

test('StreamingLogParser decodes nested structs whose dependencies arrive in separate later chunks', async () => {
	// Build a log where the struct data record appears BEFORE both nested schemas, then schemas arrive one by one
	const writer = new DataLogWriter();
	writer.close();
	const headerChunks: Uint8Array[] = [];
	for await (const chunk of writer.readable) {
		headerChunks.push(chunk);
	}

	const pairBytes = new Uint8Array(16);
	const pairView = new DataView(pairBytes.buffer);
	pairView.setFloat64(0, 1.5, true);
	pairView.setFloat64(8, 2.5, true);

	const rawLog = concatBytes([
		...headerChunks,
		makeRecord(0, 0n, makeStartPayload(1, '/Robot/Pair', 'struct:Pair')),
		makeRecord(0, 0n, makeStartPayload(2, '/.schema/struct:Pair', 'structschema')),
		makeRecord(0, 0n, makeStartPayload(3, '/.schema/struct:A', 'structschema')),
		makeRecord(0, 0n, makeStartPayload(4, '/.schema/struct:B', 'structschema')),
		// Data record arrives before Pair, A, and B schemas
		makeRecord(1, 1000n, pairBytes),
		makeRecord(2, 2000n, encoder.encode('A first; B second;')),
		// First dependency arrives while second is still missing (must re-queue under B)
		makeRecord(3, 3000n, encoder.encode('double x;')),
		makeRecord(4, 4000n, encoder.encode('double y;')),
	]);

	const parsed = streamInChunks(rawLog, 5);
	expect(parsed.entries.get('/Robot/Pair')?.samples.values()).toEqual([{ first: { x: 1.5 }, second: { y: 2.5 } }]);
	expect(parsed.unreadBytes).toBe(0);
});

test('StreamingLogParser handles partial trailing records and damaged tails identically to parseLog', () => {
	const corruptTail = new Uint8Array([0x01, 0xff, 0xff, 0, 0, 0x00, 5, 8, 0, 0, 0, 0, 0, 0, 0, 0xf0, 0x3f]);
	const damaged = new Uint8Array(log.length + corruptTail.length);
	damaged.set(log);
	damaged.set(corruptTail, log.length);

	const expected = parseLog(damaged, () => {});
	const actual = streamInChunks(damaged, 13);
	expect(actual.unreadBytes).toBe(expected.unreadBytes);
	expect(actual.entries.get('/Robot/Subsystem0/Number0')?.samples.values()).toEqual(
		expected.entries.get('/Robot/Subsystem0/Number0')?.samples.values(),
	);

	// Header with garbage records and zero readable entries must throw
	const unreadable = new Uint8Array(76);
	unreadable.set(log.subarray(0, 12));
	expect(() => streamInChunks(unreadable, 7)).toThrow("It's damaged, and none of it could be read.");
});
