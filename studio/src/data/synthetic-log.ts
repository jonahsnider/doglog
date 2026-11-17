// Generates WPILOG files shaped like a robot's match log, for benchmarks.
// Format: https://github.com/wpilibsuite/allwpilib/blob/main/wpiutil/doc/datalog.adoc

const textEncoder = new TextEncoder();

/** Bytes needed to store `value` as an unsigned little-endian integer */
function byteLength(value: number): number {
	let length = 1;
	while (value >= 256 ** length) {
		length++;
	}
	return length;
}

class LogWriter {
	readonly bytes: Uint8Array<ArrayBuffer>;
	private readonly view: DataView;
	offset = 0;
	private nextEntryId = 1;

	constructor(capacity: number) {
		this.bytes = new Uint8Array(capacity);
		this.view = new DataView(this.bytes.buffer);
		this.writeBytes(textEncoder.encode('WPILOG'));
		this.view.setUint16(this.offset, 0x01_00, true);
		this.offset += 2;
		this.writeUint32(0);
	}

	private writeUint(value: number, length: number): void {
		let remaining = value;
		for (let i = 0; i < length; i++) {
			this.bytes[this.offset++] = remaining % 256;
			remaining = Math.floor(remaining / 256);
		}
	}

	private writeUint32(value: number): void {
		this.view.setUint32(this.offset, value, true);
		this.offset += 4;
	}

	private writeBytes(bytes: Uint8Array): void {
		this.bytes.set(bytes, this.offset);
		this.offset += bytes.length;
	}

	private writeString(value: string): void {
		const bytes = textEncoder.encode(value);
		this.writeUint32(bytes.length);
		this.writeBytes(bytes);
	}

	/** Write a record's header, the caller writes its `payloadSize` bytes of payload next */
	private writeHeader(entryId: number, payloadSize: number, timestamp: number): void {
		const idLength = byteLength(entryId);
		const sizeLength = byteLength(payloadSize);
		const timestampLength = byteLength(timestamp);
		this.bytes[this.offset++] = (idLength - 1) | ((sizeLength - 1) << 2) | ((timestampLength - 1) << 4);
		this.writeUint(entryId, idLength);
		this.writeUint(payloadSize, sizeLength);
		this.writeUint(timestamp, timestampLength);
	}

	/** Start an entry, returns its ID */
	start(name: string, type: string, timestamp: number): number {
		const id = this.nextEntryId++;
		const nameSize = textEncoder.encode(name).length;
		const typeSize = textEncoder.encode(type).length;
		this.writeHeader(0, 1 + 4 + 4 + nameSize + 4 + typeSize + 4, timestamp);
		this.bytes[this.offset++] = 0;
		this.writeUint32(id);
		this.writeString(name);
		this.writeString(type);
		this.writeString('');
		return id;
	}

	doubles(entryId: number, timestamp: number, values: readonly number[]): void {
		this.writeHeader(entryId, values.length * 8, timestamp);
		for (const value of values) {
			this.view.setFloat64(this.offset, value, true);
			this.offset += 8;
		}
	}

	boolean(entryId: number, timestamp: number, value: boolean): void {
		this.writeHeader(entryId, 1, timestamp);
		this.bytes[this.offset++] = value ? 1 : 0;
	}

	raw(entryId: number, timestamp: number, payload: Uint8Array): void {
		this.writeHeader(entryId, payload.length, timestamp);
		this.writeBytes(payload);
	}
}

/** Robot loop period in microseconds */
const loopPeriod = 20_000;

/**
 * A log of about `size` bytes, with entries a robot logs every loop: many numbers, some booleans, poses,
 * swerve module states, number arrays, and strings that change occasionally.
 */
export function syntheticLog(size: number): Uint8Array<ArrayBuffer> {
	// The last loop can go past `size`
	const log = new LogWriter(size + 64 * 1024);

	const schemas = {
		Rotation2d: 'double value',
		Translation2d: 'double x;double y',
		Pose2d: 'Translation2d translation;Rotation2d rotation',
		SwerveModuleState: 'double speed;Rotation2d angle',
	};
	for (const [name, schema] of Object.entries(schemas)) {
		const id = log.start(`/.schema/struct:${name}`, 'structschema', 0);
		log.raw(id, 0, textEncoder.encode(schema));
	}

	const startEntries = (count: number, name: string, type: string) =>
		Array.from({ length: count }, (_, i) => log.start(`/Robot/Subsystem${i % 20}/${name}${i}`, type, 0));
	const numbers = startEntries(300, 'Number', 'double');
	const booleans = startEntries(50, 'Boolean', 'boolean');
	const poses = startEntries(20, 'Pose', 'struct:Pose2d');
	const moduleStates = startEntries(4, 'ModuleStates', 'struct:SwerveModuleState[]');
	const arrays = startEntries(5, 'Array', 'double[]');
	const strings = startEntries(10, 'String', 'string');
	const stringValues = ['Idle', 'Intaking', 'Shooting', 'Climbing'].map((value) => textEncoder.encode(value));

	for (let loop = 0; log.offset < size; loop++) {
		const timestamp = loop * loopPeriod;
		const wave = (i: number) => Math.sin(loop / 50 + i);

		for (const [i, id] of numbers.entries()) {
			log.doubles(id, timestamp, [wave(i)]);
		}
		for (const [i, id] of booleans.entries()) {
			log.boolean(id, timestamp, wave(i) > 0);
		}
		for (const [i, id] of poses.entries()) {
			log.doubles(id, timestamp, [8 + 4 * wave(i), 4 + 2 * wave(i + 1), Math.PI * wave(i + 2)]);
		}
		for (const [i, id] of moduleStates.entries()) {
			log.doubles(
				id,
				timestamp,
				Array.from({ length: 8 }, (_, j) => wave(i + j)),
			);
		}
		for (const [i, id] of arrays.entries()) {
			log.doubles(
				id,
				timestamp,
				Array.from({ length: 10 }, (_, j) => wave(i + j)),
			);
		}
		// Once a second
		if (loop % 50 === 0) {
			for (const [i, id] of strings.entries()) {
				log.raw(id, timestamp, stringValues[(loop / 50 + i) % stringValues.length]!);
			}
		}
	}

	return log.bytes.subarray(0, log.offset);
}
