import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';

export async function readLogFixture(path: string, signal: string, allowHoot = false) {
	const bytes = await readFile(path);
	const format = extname(path).slice(1);
	if (format === 'hoot' && allowHoot) {
		if (bytes.length < 72) throw new Error('The .hoot file is too short to contain a log header.');
	} else if (format !== 'wpilog' || bytes.toString('ascii', 0, 6) !== 'WPILOG') {
		throw new Error(`Expected ${allowHoot ? 'a .hoot or an uncompressed' : 'an uncompressed'} .wpilog file.`);
	}
	return {
		bytes,
		format,
		logName: basename(path),
		logBytes: bytes.length,
		logSha256: createHash('sha256').update(bytes).digest('hex'),
		signal,
	};
}
