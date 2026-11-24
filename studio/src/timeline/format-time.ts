/** Format a time (µs) as minutes and seconds since the start of the source, ex. `0:02.50` or `1:05.00` */
export function formatTime(time: number, start: number): string {
	// Round to hundredths first so 59.999 s becomes 1:00.00 instead of 0:60.00
	const hundredths = Math.round((time - start) / 10_000);
	const minutes = Math.floor(hundredths / 6000);
	const seconds = ((hundredths % 6000) / 100).toFixed(2).padStart(5, '0');
	return `${minutes}:${seconds}`;
}

/** Format a duration (µs) as seconds below a minute, ex. `1.50 s`, or as clock time, ex. `1:05.25` */
export function formatDuration(duration: number): string {
	if (Math.round(duration / 10_000) >= 6000) {
		return formatTime(duration, 0);
	}
	const seconds = duration / 1_000_000;
	return `${seconds.toFixed(seconds < 0.1 ? 3 : 2)} s`;
}

/** Format a rough duration (µs) as minutes and whole seconds, ex. `3:49` */
export function formatRoughDuration(duration: number): string {
	const seconds = Math.round(duration / 1_000_000);
	return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
