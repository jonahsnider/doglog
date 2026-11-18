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
	expect(entries.get('/Robot/Subsystem0/Number0')?.samples.values).toEqual(
		parse(log).entries.get('/Robot/Subsystem0/Number0')?.samples.values,
	);
});

test('a log with no readable entries throws', () => {
	const bytes = new Uint8Array(76);
	bytes.set(log.subarray(0, 12));
	expect(() => parse(bytes)).toThrow("It's damaged, and none of it could be read.");
});
