import { expect, test } from 'vite-plus/test';
import { parseLog } from '@/data/parse-log';
import { syntheticLog } from '@/data/synthetic-log';

const log = syntheticLog(64 * 1024);
const parse = (bytes: Uint8Array) => parseLog(bytes, () => {});
const withTail = (tail: Uint8Array) => {
	const bytes = new Uint8Array(log.length + tail.length);
	bytes.set(log);
	bytes.set(tail, log.length);
	return bytes;
};

test('a complete log is read completely', () => {
	expect(parse(log).unreadBytes).toBe(0);
});

test('a partial last record is unread', () => {
	// The first record's header, without its payload
	expect(parse(withTail(log.subarray(12, 17))).unreadBytes).toBe(5);
});

// Like a log from a robot that lost power, where the file system reserved blocks it never wrote and they hold leftover data
test('leftover data after the last record is unread, and its records are not loaded', () => {
	// A record for an entry that was never started, then one that happens to look like a number for a real entry
	const tail = new Uint8Array([0x01, 0xff, 0xff, 0, 0, 0x00, 5, 8, 0, 0, 0, 0, 0, 0, 0, 0xf0, 0x3f]);
	const { unreadBytes, entries } = parse(withTail(tail));
	expect(unreadBytes).toBe(tail.length);
	expect(entries.get('/Robot/Subsystem0/Number0')?.samples.values()).toEqual(
		parse(log).entries.get('/Robot/Subsystem0/Number0')?.samples.values(),
	);
});

/** A record with a 1 byte entry ID and payload size, and an 8 byte timestamp in microseconds */
function record(entryId: number, timestamp: bigint, payload: Uint8Array): Uint8Array {
	const bytes = new Uint8Array(11 + payload.length);
	bytes.set([0x70, entryId, payload.length]);
	new DataView(bytes.buffer).setBigInt64(3, timestamp, true);
	bytes.set(payload, 11);
	return bytes;
}

function startPayload(entryId: number, name: string, type: string): Uint8Array {
	const strings = [name, type, ''].map((text) => new TextEncoder().encode(text));
	const bytes = new Uint8Array(5 + strings.reduce((total, text) => total + 4 + text.length, 0));
	const view = new DataView(bytes.buffer);
	view.setUint32(1, entryId, true);
	let offset = 5;
	for (const text of strings) {
		view.setUint32(offset, text.length, true);
		bytes.set(text, offset + 4);
		offset += 4 + text.length;
	}
	return bytes;
}

function double(value: number): Uint8Array {
	const bytes = new Uint8Array(8);
	new DataView(bytes.buffer).setFloat64(0, value, true);
	return bytes;
}

// Like a Limelight's NetworkTables values that were set before the robot started logging, which have negative timestamps
test('values set before the log started are values at its start, and the log still ends at its last record', () => {
	const tail = [
		record(0, 0n, startPayload(200, '/Limelight/tx', 'double')),
		// Set 2 s before the log started, then logged out of order with an older value
		record(200, -2_000_000n, double(2)),
		record(200, -5_000_000n, double(1)),
		// An entry that's also logged at the start of the log, which is newer
		record(5, -5_000_000n, double(42)),
	];
	const { start, end, entries } = parse(withTail(new Uint8Array(tail.flatMap((bytes) => Array.from(bytes)))));
	const plain = parse(log);

	expect(end).toBe(plain.end);
	expect(entries.get('/Limelight/tx')?.samples.valueAt(start!)).toBe(2);
	expect(entries.get('/Robot/Subsystem0/Number0')?.samples.values()).toEqual(
		plain.entries.get('/Robot/Subsystem0/Number0')?.samples.values(),
	);
});

test("a value that doesn't match its struct schema is skipped, and later records are still loaded", () => {
	const tail = [
		record(0, 0n, startPayload(200, '/.schema/struct:Pair', 'structschema')),
		record(200, 0n, new TextEncoder().encode('double a;double b')),
		record(0, 0n, startPayload(201, '/Pair', 'struct:Pair')),
		record(0, 0n, startPayload(202, '/After', 'double')),
		// 4 bytes, but the schema needs 16
		record(201, 1_000n, new Uint8Array(4)),
		record(202, 2_000n, double(3)),
	];
	const { entries } = parse(withTail(new Uint8Array(tail.flatMap((bytes) => Array.from(bytes)))));

	expect(entries.get('/Pair')?.samples.length).toBe(0);
	expect(entries.get('/After')?.samples.values()).toEqual([3]);
});

test('a log with no readable entries throws', () => {
	const bytes = new Uint8Array(76);
	bytes.set(log.subarray(0, 12));
	expect(() => parse(bytes)).toThrow("It's damaged, and none of it could be read.");
});
