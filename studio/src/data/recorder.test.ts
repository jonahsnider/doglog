import { expect, test } from 'vite-plus/test';
import { DataLogWriter, isDataRecord, parseDataLog } from 'wpilog-parser';
import { parseLog } from '@/data/log-reader';
import { recordedGaps, toLiveTimes } from '@/data/read-recording';
import { finishRecords, Recorder, type RecordingClock } from '@/data/recorder';

const second = 1_000_000;
// Studio's clock when it first connected, the robot's clock was at 100 s
const studioStart = 1_800_000_000 * second;

async function bytesOf(writer: DataLogWriter): Promise<Uint8Array> {
	writer.close();
	return new Uint8Array(await new Response(writer.readable).arrayBuffer());
}

/** Payloads of entries that are read as raw bytes, by entry name */
function rawPayloads(bytes: Uint8Array): Map<string, Uint8Array> {
	const payloads = new Map<string, Uint8Array>();
	for (const record of parseDataLog(bytes)) {
		if (isDataRecord(record) && record.type === 'raw') {
			payloads.set(record.entry.name, record.payload);
		}
	}
	return payloads;
}

/** A session where the robot is power cycled at 300 s on its clock, and Studio reconnects 40 s later */
function recordSession(): Promise<Uint8Array> {
	const writer = new DataLogWriter();
	const recorder = new Recorder(writer, '10.5.81.2');
	const at = (time: number) => studioStart + time - 100 * second;
	recorder.record({ type: 'connected', liveTime: at(100 * second), serverTime: 100 * second });
	recorder.record({
		type: 'announce',
		name: '/Arm/Angle',
		topicType: 'double',
		properties: { unit: 'deg' },
		liveTime: at(100 * second),
	});
	// Changed before Studio connected
	recorder.record({ type: 'value', name: '/Arm/Angle', topicType: 'double', value: 1, serverTime: 50 * second });
	// Cached without a time
	recorder.record({ type: 'value', name: '/Arm/Enabled', topicType: 'boolean', value: true, serverTime: 0 });
	recorder.record({ type: 'value', name: '/Count', topicType: 'int', value: 5, serverTime: 120 * second });
	recorder.record({
		type: 'value',
		name: '/Vision/Result',
		topicType: 'protobuf',
		value: new Uint8Array([1, 2, 3]),
		serverTime: 120 * second,
	});
	// A struct value before its schema, which can't be decoded yet
	recorder.record({
		type: 'value',
		name: '/Target',
		topicType: 'struct:Translation2d',
		value: new Uint8Array(new Float64Array([1.5, -2]).buffer),
		serverTime: 130 * second,
	});
	recorder.record({
		type: 'value',
		name: '/.schema/struct:Translation2d',
		topicType: 'structschema',
		value: new TextEncoder().encode('double x;double y'),
		serverTime: 130 * second,
	});
	recorder.record({ type: 'status', status: 'reconnecting', liveTime: at(300 * second) });

	// The robot's clock restarted, it's been on for 5 s
	recorder.record({ type: 'connected', liveTime: at(340 * second), serverTime: 5 * second });
	recorder.record({ type: 'value', name: '/Arm/Angle', topicType: 'double', value: 2, serverTime: 6 * second });
	return bytesOf(writer);
}

test('a recording is on the robot clock and continues after it resets', async () => {
	const bytes = await recordSession();
	const { entries, recording, start, end } = parseLog(bytes, () => {});

	expect(start).toBe(100 * second);
	// Placed at the first connection, so the log starts when Studio connected
	expect(entries.get('/Arm/Angle')?.samples.timestamps.slice(0, 2)).toEqual(
		new Float64Array([100 * second, 341 * second]),
	);
	expect(JSON.parse(entries.get('/Arm/Angle')!.metadata)).toEqual({ unit: 'deg' });
	expect(entries.get('/Arm/Enabled')?.samples.timestamps[0]).toBe(100 * second);
	expect(entries.get('/Count')?.type).toBe('int64');
	expect(entries.get('/Count')?.samples.values()).toEqual([5]);
	expect([...entries.keys()].some((name) => name.startsWith('/DogLogStudio/'))).toBe(false);
	expect(recordedGaps(recording!, end!)).toEqual([{ start: 300 * second, end: 340 * second }]);

	// Bytes Studio can't decode, and structs, are kept as the robot sent them
	expect(rawPayloads(bytes).get('/Vision/Result')).toEqual(new Uint8Array([1, 2, 3]));
	expect(entries.get('/Target')?.samples.values()).toEqual([{ x: 1.5, y: -2 }]);
});

test('a restored recording has the live times, and continues in the same file', async () => {
	const bytes = await recordSession();
	const parsed = parseLog(bytes, () => {});
	const restored = toLiveTimes(parsed.entries.values(), parsed.recording!, parsed.end!)!;

	expect(restored.host).toBe('10.5.81.2');
	expect(restored.start).toBe(studioStart);
	expect(parsed.entries.get('/Arm/Angle')?.samples.timestamps.slice(0, 2)).toEqual(
		new Float64Array([studioStart, studioStart + 241 * second]),
	);
	// As NT4 announces it when the session reconnects
	expect(parsed.entries.get('/Count')?.type).toBe('int');
	expect(restored.gaps).toEqual([{ start: studioStart + 200 * second, end: studioStart + 240 * second }]);
	// Studio closed without saying it disconnected, so it was connected until the last record
	expect(restored).toMatchObject({ connected: true, disconnected: false, disconnectedAt: studioStart + 241 * second });

	// Continue the file like the recording worker does
	const writer = new DataLogWriter();
	const recorder = new Recorder(writer, restored.host, restored.clock satisfies RecordingClock);
	recorder.record({ type: 'status', status: 'reconnecting', liveTime: restored.disconnectedAt });
	// The robot stayed on
	recorder.record({ type: 'connected', liveTime: studioStart + 300 * second, serverTime: 65 * second });
	recorder.record({ type: 'value', name: '/Arm/Angle', topicType: 'double', value: 3, serverTime: 66 * second });
	const continued = (await bytesOf(writer)).subarray(12);
	const finishes = finishRecords(parsed.openEntryIds, restored.time);
	const combined = new Uint8Array(bytes.length + finishes.length + continued.length);
	combined.set(bytes);
	combined.set(finishes, bytes.length);
	combined.set(continued, bytes.length + finishes.length);

	const { entries, recording, end, unreadBytes } = parseLog(combined, () => {});
	expect(unreadBytes).toBe(0);
	expect(entries.get('/Arm/Angle')?.samples.values()).toEqual([1, 2, 3]);
	expect(entries.get('/Arm/Angle')?.samples.timestamps[2]).toBe(401 * second);
	expect(recordedGaps(recording!, end!)).toEqual([
		{ start: 300 * second, end: 340 * second },
		{ start: 341 * second, end: 400 * second },
	]);
});
