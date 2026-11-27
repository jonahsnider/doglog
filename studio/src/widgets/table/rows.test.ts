import { expect, test } from 'vite-plus/test';
import { createSamples } from '@/data/samples';
import { mergeTimes } from '@/widgets/table/rows';

function samplesAt(...timestamps: number[]) {
	const samples = createSamples('number');
	for (const timestamp of timestamps) {
		samples.push(timestamp, timestamp);
	}
	return samples;
}

test('mergeTimes has one row per time any source logged at, in order', () => {
	// Repeats within a source and across sources share a row, and sources end at different times
	const times = mergeTimes([samplesAt(10, 30, 30, 50, 70), createSamples('number'), samplesAt(5, 30, 40)]);

	expect([...times]).toEqual([5, 10, 30, 40, 50, 70]);
});
