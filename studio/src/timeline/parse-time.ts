/**
 * Parse a time typed like `formatTime()` shows it, ex. `1:05.5`, or as seconds, ex. `65.5`,
 * into µs on the clock `start` is on. `undefined` if it isn't a time.
 */
export function parseTime(text: string, start: number): number | undefined {
	const match = /^(?:(\d+):)?(\d+(?:\.\d*)?|\.\d+)$/u.exec(text.trim());
	if (!match) {
		return undefined;
	}
	const [, minutes = '0', seconds = '0'] = match;
	return start + Math.round((Number(minutes) * 60 + Number(seconds)) * 1_000_000);
}
