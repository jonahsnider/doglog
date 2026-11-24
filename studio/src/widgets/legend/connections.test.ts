import { expect, test } from 'vite-plus/test';
import { assignLanes } from '@/widgets/legend/connections';

test('short links stay inside overlapping links, while disjoint links reuse lanes', () => {
	const near = { sourceId: '2', targetId: '3', color: undefined };
	const far = { sourceId: '2', targetId: '6', color: undefined };
	const above = { sourceId: '2', targetId: '0', color: undefined };
	const crossing = { sourceId: '5', targetId: '7', color: undefined };
	const { lanes, count } = assignLanes([far, crossing, above, near], Number);

	expect(lanes.get(near)).toBe(0);
	expect(lanes.get(crossing)).toBe(0);
	expect(lanes.get(above)).toBe(1);
	expect(lanes.get(far)).toBe(2);
	expect(count).toBe(3);
});
