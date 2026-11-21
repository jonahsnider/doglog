// Reads back what Studio wrote to a live session's recording, see `@/data/recorder`
import { hiddenEntries, type RecordingClock, recordingPrefix } from '@/data/recorder';
import type { Samples } from '@/data/samples';

/** A connection recorded in a log, times on the recording's clock */
type RecordedConnection = { start: number; studioTime?: number; serverTime?: number; end?: number };

/** What a log says about the live session it recorded, see `readRecordingValue()` */
export type RecordingInfo = {
	host: string | undefined;
	/** The latest status */
	status: string | undefined;
	connections: RecordedConnection[];
	/** The time of the latest of these values */
	end: number;
};

/** Whether `name` is an entry Studio adds to recordings, which aren't shown */
export function isRecordingEntry(name: string): boolean {
	return name.startsWith(recordingPrefix);
}

/** Read a value of an entry Studio added to a recording */
export function readRecordingValue(info: RecordingInfo, name: string, time: number, value: unknown): void {
	const last = info.connections.at(-1);
	info.end = Math.max(info.end, time);
	switch (name) {
		case hiddenEntries.host:
			info.host = String(value);
			break;
		case hiddenEntries.status:
			info.status = String(value);
			if (value === 'connected') {
				info.connections.push({ start: time });
			} else if (last && last.end === undefined) {
				last.end = time;
			}
			break;
		case hiddenEntries.studioTime:
			if (last && typeof value === 'bigint') {
				last.studioTime = Number(value);
			}
			break;
		case hiddenEntries.serverTime:
			if (last && typeof value === 'bigint') {
				last.serverTime = Number(value);
			}
			break;
	}
}

/** When each connection ended, the start of the next one for a connection that was never closed, ex. after a crash */
function connectionEnds(connections: readonly RecordedConnection[], end: number): number[] {
	return connections.map((connection, index) => connection.end ?? connections[index + 1]?.start ?? end);
}

/** When Studio was disconnected between connections, on the recording's clock */
export function recordedGaps(info: RecordingInfo, end: number): { start: number; end: number }[] {
	const ends = connectionEnds(info.connections, end);
	return info.connections.slice(1).flatMap((next, index) => {
		const start = ends[index]!;
		return start < next.start ? [{ start, end: next.start }] : [];
	});
}

/** A recording read back as the live session it recorded, see `toLiveTimes()` */
export type RestoredRecording = {
	host: string;
	/** Whether the user disconnected the session, otherwise it reconnects */
	disconnected: boolean;
	/** When the session was last connected, on Studio's clock */
	disconnectedAt: number;
	start: number;
	gaps: { start: number; end: number }[];
	clock: RecordingClock;
	/** The recording's time Studio continues it from */
	time: number;
	/** Whether the recording still says it's connected, ex. after a crash */
	connected: boolean;
};

/**
 * Turn a recording's entries back into the live session's: types as NT4 names them, and samples moved from the
 * recording's clock to Studio's like the live session showed them. Each connection's samples move by the difference
 * between the clocks when it was made, and samples from before it go at its start. `end` is the recording's last time.
 * Returns `undefined` for a log Studio didn't record, without changing its entries.
 */
export function toLiveTimes(
	entries: Iterable<{ type: string; samples: Samples }>,
	info: RecordingInfo,
	end: number,
): RestoredRecording | undefined {
	const connections = info.connections.filter(
		(connection): connection is Required<Omit<RecordedConnection, 'end'>> & RecordedConnection =>
			connection.studioTime !== undefined && connection.serverTime !== undefined,
	);
	const last = connections.at(-1);
	if (info.host === undefined || last === undefined) {
		return undefined;
	}
	const ends = connectionEnds(connections, end);
	const deltas = connections.map((connection) => connection.studioTime - connection.start);

	for (const entry of entries) {
		// WPILOG names NT4's integers `int64`, the live session would replace entries whose type changed when reconnecting
		entry.type = entry.type === 'int64' ? 'int' : entry.type === 'int64[]' ? 'int[]' : entry.type;
		const { timestamps, length } = entry.samples;
		// Samples are sorted, so the connection they're in only moves forward
		let index = 0;
		for (let sample = 0; sample < length; sample++) {
			const time = timestamps[sample]!;
			while (index < connections.length - 1 && time > ends[index]!) {
				index++;
			}
			const connection = connections[index]!;
			timestamps[sample] = time < connection.start ? connection.studioTime : time + deltas[index]!;
		}
	}

	const lastEnd = ends.at(-1)!;
	return {
		host: info.host,
		disconnected: info.status === 'disconnected',
		disconnectedAt: lastEnd + deltas.at(-1)!,
		start: connections[0]!.studioTime,
		gaps: connections.slice(1).flatMap((next, index) => {
			const start = ends[index]! + deltas[index]!;
			return start < next.studioTime ? [{ start, end: next.studioTime }] : [];
		}),
		clock: { shift: last.start - last.serverTime, offset: last.studioTime - last.serverTime },
		time: lastEnd,
		connected: info.status === 'connected',
	};
}
