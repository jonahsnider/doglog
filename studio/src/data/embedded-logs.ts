import { decompress } from '@/data/decompress';
import { controlBits, controlDataName, controlWordEntries, driverStationEntries } from '@/data/driver-station';
import { parseHoot } from '@/data/parse-hoot';
import { type EmbeddedLog, type ParsedLog, parseLog } from '@/data/parse-log';
import { findEntry, readableEmbeddedLogFormats, type Value } from '@/data/samples';
import { isXz } from '@/data/xz';

// Times are in µs

/** An embedded log this close to the robot's clock is on the robot's clock, ex. one written by the robot itself */
const sameClockTolerance = 50_000;
/** How far apart the same enable or disable can be in a log and an embedded log once lined up, ex. from network latency */
const edgeTolerance = 250_000;

/** When the robot was enabled (`rising`) or disabled */
type Edge = { time: number; rising: boolean };

/** Boolean entries for whether the robot is enabled besides WPILib's and AdvantageKit's, ex. Phoenix's in HOOT logs */
const enabledEntries = ['/RobotEnable', '/DS:controlWord/enabled'];

/**
 * Add the entries of the embedded logs Studio reads under the name of the entry each is embedded in, ex.
 * `/WPILOG/Arm/Angle`. Embedded logs that can't be read are left out, their entries are still listed and can be exported.
 */
export async function addEmbeddedLogs(log: ParsedLog): Promise<void> {
	const readable = log.embeddedLogs.filter(({ format }) => readableEmbeddedLogFormats.has(format));
	if (readable.length === 0) {
		return;
	}
	// Read before the first await, since the log's entries are sent to the main thread while embedded logs are read
	const robot = enableEdges(log);
	const files = await Promise.all(
		readable.map(({ bytes }) => (isXz(bytes) ? decompress(bytes) : Promise.resolve(bytes))),
	);
	for (const [index, embedded] of readable.entries()) {
		try {
			addEmbeddedLog(log, embedded, files[index]!, robot);
		} catch {
			// Damaged so none of it could be read
		}
	}
}

/**
 * Add the entries of an embedded log, `bytes` is its file, decompressed. `robot` is when the log it's embedded in shows
 * the robot was enabled and disabled. Throws if it can't be read.
 */
function addEmbeddedLog(log: ParsedLog, embedded: EmbeddedLog, bytes: Uint8Array, robot: Edge[]): void {
	const parse = embedded.format === 'hoot' ? parseHoot : parseLog;
	// The byte ranges of a decompressed log don't match the captures of the compressed one
	const bound = bytes === embedded.bytes ? new CaptureBound(embedded.captures) : undefined;
	const child = parse(bytes, () => {}, bound?.add);
	if (child.start === undefined || child.end === undefined) {
		return;
	}

	const offset = clockOffset(robot, embedded, bound?.bound, child);
	for (const [name, entry] of child.entries) {
		for (let i = 0; i < entry.samples.length; i++) {
			entry.samples.timestamps[i]! += offset;
		}
		log.entries.set(`${embedded.name}${name}`, entry);
	}
	for (const [name, fields] of child.structSchemas) {
		if (!log.structSchemas.has(name)) {
			log.structSchemas.set(name, fields);
		}
	}
	log.start = Math.min(log.start ?? Infinity, child.start + offset);
	log.end = Math.max(log.end ?? -Infinity, child.end + offset);
}

/**
 * What to add to an embedded log's times to put them on the robot's clock, since they can be on any clock, ex. a
 * coprocessor's. Lined up by when it was captured, or by when the robot was enabled and disabled if every capture was late.
 */
function clockOffset(robot: Edge[], embedded: EmbeddedLog, bound: number | undefined, child: ParsedLog): number {
	// Without it, it started about when it was first captured
	const guess = bound ?? embedded.captures[0]!.time - child.start!;
	const edges = edgeOffset(robot, enableEdges(child), bound, guess);
	// The bound is as close as the most prompt capture, enables well before it show that every capture was late
	const offset = edges !== undefined && (bound === undefined || edges < bound - edgeTolerance) ? edges : guess;
	return Math.abs(offset) <= sameClockTolerance ? 0 : offset;
}

/**
 * The largest offset an embedded log's clock can have: data is written before it's captured, so every record happened
 * no later than the capture that added it. Captures that were held back, ex. while the log was paused, only give looser
 * limits, so this is as close as the most prompt capture.
 */
class CaptureBound {
	bound: number | undefined;
	private capture = 0;
	private readonly captures: EmbeddedLog['captures'];

	constructor(captures: EmbeddedLog['captures']) {
		this.captures = captures;
	}

	/** Add a record by where it ends in the file and its time, records are added in file order */
	readonly add = (end: number, timestamp: number): void => {
		while (this.capture < this.captures.length - 1 && this.captures[this.capture]!.end < end) {
			this.capture++;
		}
		this.bound = Math.min(this.bound ?? Infinity, this.captures[this.capture]!.time - timestamp);
	};
}

/** When the robot was enabled and disabled, from a log's Driver Station data. Empty without it. */
function enableEdges({ entries }: ParsedLog): Edge[] {
	const find = (names: readonly string[], type: string) =>
		names.map((name) => findEntry(entries, name)).find((entry) => entry?.type === type && entry.samples.length > 0);
	const flag = find([...driverStationEntries.map(([name]) => name), ...enabledEntries], 'boolean');
	const controlWord = find(controlWordEntries, 'struct:ControlWord');
	const bits = find([controlDataName], 'int64');
	const source = flag ?? controlWord ?? bits;
	if (!source) {
		return [];
	}
	const isEnabled = (value: Value | undefined): boolean => {
		if (source === flag) {
			return value === true;
		}
		if (source === controlWord) {
			return typeof value === 'object' && !Array.isArray(value) && value['enabled'] === true;
		}
		return (Number(value) & controlBits.enabled) !== 0;
	};
	const { samples } = source;
	const edges: Edge[] = [];
	for (let i = 1; i < samples.length; i++) {
		const enabled = isEnabled(samples.value(i));
		if (enabled !== isEnabled(samples.value(i - 1))) {
			edges.push({ time: samples.timestamps[i]!, rising: enabled });
		}
	}
	return edges;
}

/**
 * The offset that lines up the most of an embedded log's enables and disables with the robot's, or `undefined` if none
 * do. Offsets past `bound` are left out, since data can't be captured before it happened, and ties go to the one
 * closest to `guess`, ex. when the robot was enabled several times and the embedded log only has one of them.
 *
 * The offset comes from the enables when any line up. Devices tell they're disabled when the enable signal stops coming,
 * so their logs can show disables late.
 */
function edgeOffset(robot: Edge[], embedded: Edge[], bound: number | undefined, guess: number): number | undefined {
	let best: { difference: number; rising: boolean }[] = [];
	let bestDistance = Infinity;
	for (const from of embedded) {
		for (const to of robot) {
			const candidate = to.time - from.time;
			if (from.rising !== to.rising || (bound !== undefined && candidate > bound + edgeTolerance)) {
				continue;
			}
			const differences = embedded.flatMap((edge) => {
				const match = robot.find(
					(other) => other.rising === edge.rising && Math.abs(other.time - edge.time - candidate) <= edgeTolerance,
				);
				return match ? [{ difference: match.time - edge.time, rising: edge.rising }] : [];
			});
			const distance = Math.abs(candidate - guess);
			if (differences.length > best.length || (differences.length === best.length && distance < bestDistance)) {
				best = differences;
				bestDistance = distance;
			}
		}
	}
	const enables = best.filter(({ rising }) => rising);
	const differences = (enables.length > 0 ? enables : best).map(({ difference }) => difference);
	// The median, so one edge with unusual latency doesn't move the rest
	return differences.toSorted((a, b) => a - b)[Math.floor(differences.length / 2)];
}
