import { XzReadableStream } from 'xz-decompress';

/** Decompress a `.wpilogxz` log, keeping what was read before an error since a robot that loses power cuts the file off */
export async function decompress(compressed: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
	const chunks: Uint8Array[] = [];
	try {
		await new XzReadableStream(new Blob([compressed]).stream()).pipeTo(
			new WritableStream({ write: (chunk) => void chunks.push(chunk) }),
		);
	} catch {
		// The rest is parsed like an uncompressed log that was cut off
	}
	const bytes = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.byteLength, 0));
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return bytes;
}
