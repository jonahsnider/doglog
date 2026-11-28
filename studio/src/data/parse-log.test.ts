import { expect, test } from 'vite-plus/test';
import { DataSet } from '@/data/data-set';
import { parseLog } from '@/data/log-reader';
import { fromTransfer, transferables } from '@/data/samples';
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

function double(...values: number[]): Uint8Array {
	const bytes = new Uint8Array(values.length * 8);
	const view = new DataView(bytes.buffer);
	for (const [index, value] of values.entries()) {
		view.setFloat64(index * 8, value, true);
	}
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
		record(201, 500n, double(2, 7)),
		// 4 bytes, but the schema needs 16
		record(201, 1_000n, new Uint8Array(4)),
		record(201, 1_500n, double(-3, 9)),
		record(202, 2_000n, double(3)),
	];
	const { entries } = parse(withTail(new Uint8Array(tail.flatMap((bytes) => Array.from(bytes)))));

	const samples = entries.get('/Pair')!.samples;
	expect([...samples.timestamps.subarray(0, samples.length)]).toEqual([500, 1500]);
	expect(samples.values()).toEqual([
		{ a: 2, b: 7 },
		{ a: -3, b: 9 },
	]);
	expect(entries.get('/After')?.samples.values()).toEqual([3]);
});

test('nested structs and variable-length arrays keep their fields after worker and window transfers', () => {
	const tail = [
		record(0, 0n, startPayload(200, '/Poses', 'struct:Pose[]')),
		record(200, 1_000n, double()),
		record(200, 2_000n, double(2, 7, -3, 9)),
		record(200, 3_000n, double(4, -1)),
		record(0, 0n, startPayload(201, '/.schema/struct:Pose', 'structschema')),
		record(201, 0n, new TextEncoder().encode('Point translation; double angle')),
		record(0, 0n, startPayload(202, '/.schema/struct:Point', 'structschema')),
		record(202, 0n, new TextEncoder().encode('double x')),
	];
	const { entries, structSchemas } = parse(withTail(new Uint8Array(tail.flatMap((bytes) => Array.from(bytes)))));
	const data = new DataSet(() => {}, structSchemas);
	const { type, samples } = entries.get('/Poses')!;
	const transfer = samples.toTransfer();
	const received = fromTransfer(structuredClone(transfer, { transfer: transferables(transfer) }));
	data.addEntry('/Poses', type, received);

	const otherWindow = new DataSet(() => {});
	otherWindow.addTransfer(structuredClone(data.toTransfer()));
	otherWindow.publish();
	const field = otherWindow.entries.get('/Poses/1/translation/x')?.samples;
	expect(field?.length).toBe(1);
	expect(field?.valueAt(2_000)).toBe(-3);
	expect(otherWindow.entries.get('/Poses')?.samples.valueAt(1_000)).toEqual([]);
	expect(otherWindow.entries.get('/Poses')?.samples.valueAt(3_000)).toEqual([{ translation: { x: 4 }, angle: -1 }]);
	expect(received.valueAt(2_000)).toEqual([
		{ translation: { x: 2 }, angle: 7 },
		{ translation: { x: -3 }, angle: 9 },
	]);
});

test('a log with no readable entries throws', () => {
	const bytes = new Uint8Array(76);
	bytes.set(log.subarray(0, 12));
	expect(() => parse(bytes)).toThrow("It's damaged, and none of it could be read.");
});
