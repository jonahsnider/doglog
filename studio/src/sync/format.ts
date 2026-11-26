import { convert } from 'convert';
import { parseLogName } from '@/sync/log-names';

/** Format a number of bytes in the unit that reads best, ex. `2 GB` */
export function formatSize(bytes: number): string {
	// oxlint-disable-next-line oxc/number-arg-out-of-range -- `convert`'s toString takes decimal places, not a radix
	return convert(bytes, 'bytes').to('best').toString(0);
}

export const dateTimeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** A short name for a log a person recognizes, ex. `CAPH Q12` for a match or when it started otherwise, and which part it is of a split log */
export function logLabel(name: string): string {
	const parsed = parseLogName(name);
	if (!parsed) {
		return name;
	}
	const label = parsed.match?.label ?? dateTimeFormat.format(parsed.date);
	return parsed.part === undefined ? label : `${label} (part ${parsed.part})`;
}
