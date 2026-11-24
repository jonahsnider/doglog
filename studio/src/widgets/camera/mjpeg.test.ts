import { expect, test } from 'vite-plus/test';
import { MjpegParser } from '@/widgets/camera/mjpeg';

const encoder = new TextEncoder();
const contentType = 'multipart/x-mixed-replace;boundary=boundarydonotcross';
const boundary = '\r\n--boundarydonotcross';

function bytes(...fields: (string | Uint8Array)[]): Uint8Array<ArrayBuffer> {
	return Uint8Array.from(
		fields.flatMap((field) => Array.from(typeof field === 'string' ? encoder.encode(field) : field)),
	);
}

function jpeg(value: number): Uint8Array<ArrayBuffer> {
	return Uint8Array.of(0xff, 0xd8, value, 0xff, 0xd9);
}

function part(frame: Uint8Array): Uint8Array<ArrayBuffer> {
	return bytes(
		`${boundary}\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\nX-Timestamp: 1.25\r\n\r\n`,
		frame,
	);
}

test('CameraServer frames emit at the declared length even before the next boundary arrives', async () => {
	const parser = new MjpegParser(contentType);
	const frame = jpeg(0x41);
	const data = part(frame);
	for (let index = 0; index < data.length - 1; index++) {
		expect([...parser.push(data.subarray(index, index + 1))]).toHaveLength(0);
	}
	const [completed] = parser.push(data.subarray(-1));
	expect(completed?.type).toBe('image/jpeg');
	expect(await completed?.bytes()).toEqual(frame);
	expect(parser.ended).toBe(false);
});

test('CameraServer keeps streaming after blank keepalive lines split across reads', async () => {
	const parser = new MjpegParser(contentType);
	const first = jpeg(0x41);
	const second = jpeg(0x42);
	const frames = [...parser.push(part(first))];
	for (const chunk of ['\r', '\n\r', '\n']) {
		expect([...parser.push(bytes(chunk))]).toHaveLength(0);
	}
	const remaining = bytes(part(second), `${boundary}--`);
	frames.push(...parser.push(remaining.subarray(0, 1)), ...parser.push(remaining.subarray(1)));
	expect(await Promise.all(frames.map((frame) => frame.bytes()))).toEqual([first, second]);
	expect(parser.ended).toBe(true);
});

test('a single read yields multiple exact JPEGs in order and stops at the closing delimiter', async () => {
	const parser = new MjpegParser('Multipart/X-Mixed-Replace; Boundary="boundarydonotcross"');
	const first = jpeg(0x41);
	const second = jpeg(0x42);
	const frames = [...parser.push(bytes(part(first), part(second), `${boundary}--`, part(jpeg(0x43))))];
	expect(await Promise.all(frames.map((frame) => frame.bytes()))).toEqual([first, second]);
	expect(parser.ended).toBe(true);
});

test('parts without a length use the whole delimiter, not a partial match in their bytes', async () => {
	const parser = new MjpegParser(contentType);
	const first = bytes(Uint8Array.of(0xff, 0xd8), `${boundary}x`, Uint8Array.of(0xff, 0xd9));
	const data = bytes(`${boundary}\r\ncontent-type: IMAGE/JPEG\r\n\r\n`, first, part(jpeg(0x42)), `${boundary}--`);
	const frames: Blob[] = [];
	for (let index = 0; index < data.length; index += 3) {
		for (const frame of parser.push(data.subarray(index, index + 3))) {
			frames.push(frame);
		}
	}
	expect(await Promise.all(frames.map((frame) => frame.bytes()))).toEqual([first, jpeg(0x42)]);
	expect(parser.ended).toBe(true);
});

test('partial or invalid JPEGs are never emitted', () => {
	const parser = new MjpegParser(contentType);
	const data = part(Uint8Array.of(0xff, 0xd8, 0x41, 0xff, 0x00));
	expect([...parser.push(data.subarray(0, -1))]).toHaveLength(0);
	expect(() => [...parser.push(data.subarray(-1))]).toThrow('incomplete or invalid JPEG');
});

test('rejects invalid response and part types', () => {
	expect(() => new MjpegParser('text/html')).toThrow('not a multipart MJPEG stream');
	expect(() => new MjpegParser('multipart/x-mixed-replace')).toThrow('no valid multipart boundary');
	const parser = new MjpegParser(contentType);
	expect(() => [...parser.push(bytes(`${boundary}\r\nContent-Type: image/png\r\n\r\n`))]).toThrow('non-JPEG part');
});

test('rejects an oversized declared or delimiter-terminated part, and unbounded headers', () => {
	const declared = new MjpegParser(contentType);
	expect(() => [
		...declared.push(bytes(`${boundary}\r\nContent-Type: image/jpeg\r\nContent-Length: 999999999\r\n\r\n`)),
	]).toThrow('invalid JPEG length');
	const delimited = new MjpegParser(contentType);
	expect([...delimited.push(bytes(`${boundary}\r\nContent-Type: image/jpeg\r\n\r\n`))]).toHaveLength(0);
	expect(() => [...delimited.push(new Uint8Array(9 * 1024 * 1024))]).toThrow('frame is too large');
	const headers = new MjpegParser(contentType);
	expect(() => [...headers.push(bytes(`${boundary}\r\nX-Long: ${'a'.repeat(20 * 1024)}`))]).toThrow(
		'headers are too large',
	);
});
