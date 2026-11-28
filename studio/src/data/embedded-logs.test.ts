import { expect, test } from 'vite-plus/test';
import { DataLogWriter, readRecords } from 'wpilog-parser';
import { addEmbeddedLogs } from '@/data/embedded-logs';
import { parseLog } from '@/data/log-reader';
import type { ParsedLog } from '@/data/parse-log';

const second = 1_000_000;
// A coprocessor's clock, 498 s ahead of the robot's
const ahead = 498 * second;
// Logged every 20 ms from 2 s to 12 s on the robot's clock
const robotTimes = Array.from({ length: 501 }, (_, index) => 2 * second + index * 20_000);

const parse = (bytes: Uint8Array) => parseLog(bytes, () => {});

async function bytesOf(writer: DataLogWriter): Promise<Uint8Array> {
	writer.close();
	return new Uint8Array(await new Response(writer.readable).arrayBuffer());
}

/** A log with `/Arm/Angle` logged at `times`, and `/DS:enabled` logged as `enabled`, written in time order */
function childLog(times: readonly number[], enabled: readonly [number, boolean][] = []): Promise<Uint8Array> {
	const writer = new DataLogWriter();
	const angle = writer.start('/Arm/Angle', 'double', '', times[0]);
	const ds = writer.start('/DS:enabled', 'boolean', '', times[0]);
	const records = [
		...times.map((time, index) => [time, () => writer.append(angle, index, time)] as const),
		...enabled.map(([time, value]) => [time, () => writer.append(ds, value, time)] as const),
	];
	for (const [, append] of records.toSorted(([a], [b]) => a - b)) {
		append();
	}
	return bytesOf(writer);
}

/**
 * A robot log with `child` embedded in `/WPILOG`. Each capture adds `child`'s records up to `through` (on its clock) at
 * `at` (on the robot's clock), in the order given. The robot logs `/DS:enabled` as `enabled`.
 */
function embed(
	child: Uint8Array,
	captures: readonly { through: number; at: number }[],
	enabled: readonly [number, boolean][] = [],
): Promise<Uint8Array> {
	const ends: { time: number; end: number }[] = [];
	const records = readRecords(child);
	for (const record of records) {
		if (record.kind === 'data') {
			ends.push({ time: record.record.timestamp, end: records.bytesRead });
		}
	}
	const endAt = (through: number) => Math.max(0, ...ends.filter(({ time }) => time <= through).map(({ end }) => end));

	const writer = new DataLogWriter();
	const robotEnabled = writer.start('/DS:enabled', 'boolean', '', 0);
	const embedded = writer.start('/WPILOG', 'log:wpilog', '', 0);
	writer.append(robotEnabled, false, 0);
	for (const [time, value] of enabled) {
		writer.append(robotEnabled, value, time);
	}
	for (const { through, at } of captures) {
		const before = captures.filter((other) => other.through < through).map((other) => endAt(other.through));
		writer.append(embedded, child.subarray(Math.max(0, ...before), endAt(through)), at);
	}
	return bytesOf(writer);
}

/** How far each of `/WPILOG/Arm/Angle`'s times is from `expected` */
function errors(log: ParsedLog, expected: readonly number[]): number[] {
	const { samples } = log.entries.get('/WPILOG/Arm/Angle')!;
	return [...samples.timestamps.subarray(0, samples.length)].map((time, index) => time - expected[index]!);
}

test('an embedded log is its captures joined in time order', async () => {
	const child = await childLog([500 * second, 501 * second]);
	const log = parse(
		await embed(child, [
			{ through: Infinity, at: 3 * second },
			{ through: 500 * second, at: 2 * second },
		]),
	);
	expect(log.embeddedLogs).toHaveLength(1);
	expect(log.embeddedLogs[0]).toMatchObject({ name: '/WPILOG', format: 'wpilog' });
	expect(log.embeddedLogs[0]!.bytes).toEqual(child);
});

test('an embedded log on another clock lines up as closely as its most prompt capture, even when others were late', async () => {
	const child = await childLog(robotTimes.map((time) => time + ahead));
	const log = parse(
		await embed(child, [
			// Held back, like while logging was paused
			{ through: 5 * second + ahead, at: 7 * second },
			{ through: 7 * second + ahead, at: 7_200_000 },
			{ through: 9 * second + ahead, at: 9_004_000 },
			{ through: Infinity, at: 12_500_000 },
		]),
	);
	await addEmbeddedLogs(log);
	const offBy = errors(log, robotTimes);
	expect(offBy).toHaveLength(robotTimes.length);
	for (const error of offBy) {
		expect(Math.abs(error)).toBeLessThanOrEqual(4000);
	}
	expect(log.entries.has('/WPILOG')).toBe(true);
});

test("an embedded log on the robot's clock keeps its times", async () => {
	const child = await childLog(robotTimes);
	const log = parse(
		await embed(child, [
			{ through: 7 * second, at: 7_004_000 },
			{ through: Infinity, at: 12_500_000 },
		]),
	);
	await addEmbeddedLogs(log);
	expect(new Set(errors(log, robotTimes))).toEqual(new Set([0]));
});

test('an embedded log that was all captured late lines up by when the robot was enabled and disabled', async () => {
	const times = Array.from({ length: 160 }, (_, index) => (index + 1) * second);
	const robotEnabled: [number, boolean][] = [
		[5 * second, true],
		[20 * second, false],
		[23 * second, true],
		[158 * second, false],
	];
	// It hears about each change 5 ms after the robot
	const child = await childLog(
		times.map((time) => time + ahead),
		[[second + ahead, false], ...robotEnabled.map(([time, value]): [number, boolean] => [time + ahead + 5000, value])],
	);
	const log = parse(await embed(child, [{ through: Infinity, at: 170 * second }], robotEnabled));
	await addEmbeddedLogs(log);
	for (const error of errors(log, times)) {
		expect(Math.abs(error)).toBeLessThanOrEqual(5000);
	}
});
