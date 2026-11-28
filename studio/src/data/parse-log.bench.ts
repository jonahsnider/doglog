import { expect, test } from 'vite-plus/test';
import { parseLog } from '@/data/log-reader';
import { transferables } from '@/data/samples';
import { syntheticLog } from '@/data/synthetic-log';

// CodSpeed counts instructions under Valgrind instead of timing, which is far slower, and a smaller log catches the same regressions
const size = (import.meta.env['CODSPEED_ENV'] === undefined ? 100 : 10) * 1024 * 1024;

// Performance spec: a 100 MB log is ready to browse within about 3 seconds
test('loading a log', { timeout: 10 * 60_000 }, async ({ bench }) => {
	const bytes = syntheticLog(size);

	const result = await bench('parse a log and send its entries to the main thread', () => {
		const { entries } = parseLog(bytes, () => {});
		// The worker posts each entry to the main thread, which copies its values
		for (const { samples } of entries.values()) {
			const transfer = samples.toTransfer();
			structuredClone(transfer, { transfer: transferables(transfer) });
		}
	}).run({ iterations: 5, time: 0, warmupIterations: 1, warmupTime: 0 });

	// CodSpeed doesn't report times, so this only checks local runs
	expect(result.latency.mean, 'a 100 MB log must load within 3 s').toBeLessThan(3000);
});
