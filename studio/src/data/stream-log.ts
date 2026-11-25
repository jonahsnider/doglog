import { DataLogStreamParser } from 'wpilog-parser';
import { LogAccumulator, logParseOptions, type ParsedLog } from '@/data/parse-log';

/**
 * Incremental WPILOG parser that consumes arbitrary byte chunks as they download, keeping only the partial record
 * spanning chunk boundaries in memory. Produces the same `ParsedLog` output and damaged-tail handling as `parseLog`.
 */
export class StreamingLogParser {
	private readonly accumulator = new LogAccumulator();
	private readonly parser = new DataLogStreamParser(logParseOptions);
	private damaged = false;
	private damageError: unknown;
	private totalBytes = 0;

	push(chunk: Uint8Array): void {
		this.totalBytes += chunk.byteLength;
		if (this.damaged) {
			return;
		}
		try {
			for (const record of this.parser.push(chunk)) {
				this.accumulator.addRecord(record);
			}
		} catch (error) {
			// Keep every record read before the damage, and ignore the rest of the file
			this.damaged = true;
			this.damageError = error;
		}
	}

	finish(): ParsedLog {
		if (this.parser.header === undefined) {
			throw new Error("It isn't a WPILOG file.", { cause: this.damageError });
		}
		if (this.damaged && this.accumulator.entries.size === 0) {
			throw new Error("It's damaged, and none of it could be read.", { cause: this.damageError });
		}
		return this.accumulator.finish(this.totalBytes, this.parser.bytesRead);
	}
}
