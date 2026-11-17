import { expect, test } from 'vite-plus/test';
import { maxLiveSamples } from '@/data/data-store';
import { Samples, trimOldest } from '@/data/samples';

/** Live history at its limit, spread across entries like a robot's topics */
function fullHistory(): Samples[] {
	const entryCount = 1000;
	const length = maxLiveSamples / entryCount;
	return Array.from({ length: entryCount }, () => {
		const timestamps = new Float64Array(length);
		const values = Array.from({ length }, (_, i) => {
			timestamps[i] = i * 20_000;
			return Math.random();
		});
		return new Samples(timestamps, values);
	});
}

// Performance spec: live values appear within about 100 ms, and the UI stays responsive while receiving live data.
// Trimming copies all of the live history on the main thread, so it's the slowest part of adding a live sample.
// The timeout is for CodSpeed, which runs benchmarks under Valgrind
test('trimming live history at its limit', { timeout: 10 * 60_000 }, async ({ bench }) => {
	let history: Samples[] = [];

	const result = await bench(
		'trim 10% of live history',
		{
			beforeEach() {
				history = fullHistory();
			},
		},
		() => {
			// Matches `trimHistory` in the data store
			trimOldest(history, maxLiveSamples * 0.1);
		},
	).run({ iterations: 10, time: 0, warmupIterations: 2, warmupTime: 0 });

	// CodSpeed doesn't report times, so this only checks local runs
	expect(result.latency.max, 'a task longer than 50 ms makes the page feel unresponsive').toBeLessThan(50);
});
