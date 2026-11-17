import { expect, test } from 'vite-plus/test';
import { fitSizes } from './split-sizes.ts';

const shares = (...sizes: number[]) => sizes.map((size): unknown => expect.closeTo(size) as unknown);

test('shares too small for their minimum take the difference from the others, in proportion to their room', () => {
	// The third share is raised to a quarter, the first two give up the difference evenly since they have equal room
	expect(fitSizes([0.425, 0.425, 0.15], [0.25, 0.25, 0.25])).toEqual(shares(0.375, 0.375, 0.25));
	// Only the first share has room to give
	expect(fitSizes([0.7, 0.15, 0.15], [0.25, 0.25, 0.25])).toEqual(shares(0.5, 0.25, 0.25));
	expect(fitSizes([0.5, 0.5], [0.25, 0.25])).toEqual([0.5, 0.5]);
});
