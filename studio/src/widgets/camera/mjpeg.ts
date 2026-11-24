const maxHeaders = 16 * 1024;
const maxFrame = 8 * 1024 * 1024;
const inputBlock = 64 * 1024;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const lineBreak = encoder.encode('\r\n');
const doubleLineBreak = encoder.encode('\r\n\r\n');

function mediaType(value: string | null): string | undefined {
	return value?.split(';', 1)[0]?.trim().toLowerCase();
}

function multipartBoundary(contentType: string | null): string {
	if (mediaType(contentType) !== 'multipart/x-mixed-replace' || contentType === null) {
		throw new Error('Camera response is not a multipart MJPEG stream.');
	}
	const parameters = contentType.matchAll(/;\s*([^\s=;]+)\s*=\s*(?:"([^"]*)"|([^\s;]+))(?=\s*(?:;|$))/gu);
	for (const [, name, quoted, token] of parameters) {
		if (name?.toLowerCase() === 'boundary') {
			const boundary = quoted ?? token ?? '';
			if (/^[\da-z'()+_,./:=? -]{1,70}$/iu.test(boundary) && !boundary.endsWith(' ')) {
				return `--${boundary}`;
			}
			break;
		}
	}
	throw new Error('Camera response has no valid multipart boundary.');
}

function matches(bytes: Uint8Array, at: number, pattern: Uint8Array): boolean {
	return pattern.every((byte, index) => bytes[at + index] === byte);
}

/** Incremental multipart parser shared by the browser and native HTTP transports. */
export class MjpegParser {
	private readonly boundary: string;
	private readonly separator: Uint8Array;
	private state: 'start' | 'headers' | 'body' | 'next' | 'end' = 'start';
	private preambleSize = 0;
	private frameLength: number | undefined;
	private buffer = new Uint8Array(0);
	private start = 0;
	private end = 0;
	private searched = 0;

	constructor(contentType: string | null) {
		this.boundary = multipartBoundary(contentType);
		this.separator = encoder.encode(`\r\n${this.boundary}`);
	}

	get ended(): boolean {
		return this.state === 'end';
	}

	*push(chunk: Uint8Array): IterableIterator<Blob> {
		// Bound the working buffer even if the transport hands us one chunk containing many parts.
		for (let offset = 0; offset < chunk.length && !this.ended; offset += inputBlock) {
			this.append(chunk.subarray(offset, offset + inputBlock));
			while (!this.ended) {
				const result = this.parseNext();
				if (result === 'wait') {
					break;
				}
				if (result !== 'continue') {
					yield result;
				}
			}
		}
	}

	private parseNext(): Blob | 'continue' | 'wait' {
		const bytes = this.buffer.subarray(this.start, this.end);
		switch (this.state) {
			case 'start': {
				const line = this.findPattern(bytes, lineBreak);
				const length = line === undefined ? bytes.length : line + lineBreak.length;
				this.checkHeaderSize(this.preambleSize + length);
				if (line === undefined) {
					return 'wait';
				}
				const text = decoder.decode(bytes.subarray(0, line));
				this.consume(length);
				this.preambleSize += length;
				if (text === this.boundary) {
					this.state = 'headers';
				} else if (text === `${this.boundary}--`) {
					this.state = 'end';
				}
				return 'continue';
			}
			case 'headers': {
				const headerLength = this.findPattern(bytes, doubleLineBreak);
				this.checkHeaderSize(headerLength ?? bytes.length - doubleLineBreak.length + 1);
				if (headerLength === undefined) {
					return 'wait';
				}
				this.readHeaders(decoder.decode(bytes.subarray(0, headerLength)));
				this.consume(headerLength + doubleLineBreak.length);
				this.state = 'body';
				return 'continue';
			}
			case 'body': {
				if (this.frameLength !== undefined) {
					if (bytes.length < this.frameLength) {
						return 'wait';
					}
					const frame = this.jpeg(bytes.subarray(0, this.frameLength));
					this.consume(this.frameLength);
					this.state = 'next';
					return frame;
				}
				// When a part omits Content-Length, its MIME delimiter identifies the end of the JPEG.
				const at = this.findPattern(bytes, this.separator, 2);
				if (at === undefined) {
					if (bytes.length > maxFrame + this.separator.length + 1) {
						throw new Error('Camera frame is too large.');
					}
					return 'wait';
				}
				return this.consumeDelimiter(bytes, at) ? this.jpeg(bytes.subarray(0, at)) : 'continue';
			}
			case 'next': {
				// Discard keepalive lines, keeping the last CRLF as part of the next delimiter.
				if (matches(bytes, 0, doubleLineBreak)) {
					this.consume(lineBreak.length);
					return 'continue';
				}
				if (bytes.length < this.separator.length + 2) {
					return 'wait';
				}
				if (!matches(bytes, 0, this.separator) || !this.consumeDelimiter(bytes, 0)) {
					throw new Error('Camera response has an invalid multipart delimiter.');
				}
				return 'continue';
			}
			case 'end':
				break;
		}
		return 'wait';
	}

	private checkHeaderSize(size: number): void {
		if (size > maxHeaders) {
			throw new Error('Camera multipart headers are too large.');
		}
	}

	private readHeaders(text: string): void {
		const headers = new Headers();
		for (const line of text.split('\r\n')) {
			const colon = line.indexOf(':');
			if (colon <= 0) {
				throw new Error('Camera response has invalid multipart headers.');
			}
			headers.append(line.slice(0, colon), line.slice(colon + 1));
		}
		if (mediaType(headers.get('content-type')) !== 'image/jpeg') {
			throw new Error('Camera stream contains a non-JPEG part.');
		}
		const length = headers.get('content-length');
		const lengthValue = Number(length);
		if (length !== null && (!/^\d+$/u.test(length) || lengthValue < 4 || lengthValue > maxFrame)) {
			throw new Error('Camera stream has an invalid JPEG length.');
		}
		this.frameLength = length === null ? undefined : lengthValue;
	}

	private jpeg(bytes: Uint8Array<ArrayBuffer>): Blob {
		if (bytes.length > maxFrame) {
			throw new Error('Camera frame is too large.');
		}
		// Check the JPEG start and end markers, without decoding or including multipart delimiters.
		if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) {
			throw new Error('Camera stream contains an incomplete or invalid JPEG.');
		}
		return new Blob([bytes], { type: 'image/jpeg' });
	}

	private consumeDelimiter(bytes: Uint8Array, at: number): boolean {
		const suffix = at + this.separator.length;
		const closing = bytes[suffix] === 0x2d && bytes[suffix + 1] === 0x2d;
		if (!closing && !matches(bytes, suffix, lineBreak)) {
			return false;
		}
		this.consume(suffix + 2);
		this.state = closing ? 'end' : 'headers';
		return true;
	}

	// Leave enough unsearched bytes to recognize a delimiter split across reads.
	private findPattern(bytes: Uint8Array, pattern: Uint8Array, tail = 0): number | undefined {
		const last = bytes.length - pattern.length - tail;
		while (this.searched <= last) {
			const at = bytes.indexOf(pattern[0]!, this.searched);
			if (at === -1 || at > last) {
				this.searched = last + 1;
				return undefined;
			}
			this.searched = at + 1;
			if (matches(bytes, at, pattern)) {
				return at;
			}
		}
		return undefined;
	}

	private consume(length: number): void {
		this.start += length;
		this.searched = 0;
	}

	private append(bytes: Uint8Array): void {
		const used = this.end - this.start;
		if (used === 0) {
			this.start = 0;
			this.end = 0;
		}
		if (this.end + bytes.length > this.buffer.length) {
			if (this.buffer.length < used + bytes.length) {
				const limit = maxFrame + this.separator.length + 2 + inputBlock;
				const next = new Uint8Array(Math.max(used + bytes.length, Math.min(this.buffer.length * 2, limit)));
				next.set(this.buffer.subarray(this.start, this.end));
				this.buffer = next;
			} else {
				this.buffer.copyWithin(0, this.start, this.end);
			}
			this.start = 0;
			this.end = used;
		}
		this.buffer.set(bytes, this.end);
		this.end += bytes.length;
	}
}
