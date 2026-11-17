import { expect, test } from 'vite-plus/test';
import {
	canJoinLayouts,
	canMovePane,
	canSplitPane,
	closePane,
	createPane,
	findSibling,
	joinLayouts,
	movePane,
	type PaneNode,
	paneNodeSchema,
	resizeSplit,
	setPaneWidget,
	type Split,
	splitPane,
} from './layout.ts';

const graph = { type: 'line-graph', config: { bindings: [{ id: 'arm', name: '/Arm/Angle' }] } };

function expectSplit(node: PaneNode): Split {
	if (node.kind !== 'split') {
		throw new Error(`Expected a split, got a ${node.kind}`);
	}
	return node;
}

const parse = (stored: unknown) => paneNodeSchema.safeParse(stored).data;

test('splitting a pane keeps it first and adds an empty pane after it', () => {
	const original = { ...createPane(), widget: graph };

	const layout = splitPane(original, original.id, 'row');

	expect(layout).toMatchObject({
		kind: 'split',
		direction: 'row',
		ratio: 0.5,
		first: original,
		second: { kind: 'pane' },
	});
	expect(expectSplit(layout).second).not.toHaveProperty('widget');
});

test('closing a pane lets its sibling take its place', () => {
	const left = { ...createPane(), widget: graph };
	const split = expectSplit(splitPane(left, left.id, 'row'));
	const right = split.second;
	const nested = expectSplit(splitPane(split, right.id, 'column'));

	// Closing the bottom right pane collapses the nested split back to the original
	const bottomRight = expectSplit(nested.second).second;
	expect(closePane(nested, bottomRight.id)).toEqual(split);

	expect(closePane(split, right.id)).toEqual(left);
});

test('the sibling of a pane is the node that takes its place when closed', () => {
	const left = createPane();
	const split = expectSplit(splitPane(left, left.id, 'row'));
	const nested = expectSplit(splitPane(split, split.second.id, 'column'));
	const right = expectSplit(nested.second);

	expect(findSibling(nested, left.id)).toBe(right);
	expect(findSibling(nested, right.second.id)).toBe(right.first);
	expect(findSibling(left, left.id)).toBeUndefined();
});

test('closing the only pane leaves an empty pane', () => {
	const pane = { ...createPane(), widget: graph };

	const layout = closePane(pane, pane.id);

	expect(layout.kind).toBe('pane');
	expect(layout).not.toHaveProperty('widget');
});

test('setting and clearing a nested pane widget', () => {
	const first = createPane();
	const split = expectSplit(splitPane(first, first.id, 'column'));
	const { second } = split;

	const withWidget = setPaneWidget(split, second.id, graph);
	expect(withWidget).toMatchObject({ first, second: { id: second.id, widget: graph } });

	expect(setPaneWidget(withWidget, second.id, undefined)).toEqual(split);
});

test('resizing clamps the ratio', () => {
	const pane = createPane();
	const split = splitPane(pane, pane.id, 'row');

	expect(resizeSplit(split, split.id, 0.3)).toMatchObject({ ratio: 0.3 });
	expect(resizeSplit(split, split.id, 2)).toMatchObject({ ratio: 0.9 });
	expect(resizeSplit(split, split.id, -1)).toMatchObject({ ratio: 0.1 });
});

test('parsing round-trips valid layouts and rejects invalid ones', () => {
	const pane = { ...createPane(), widget: graph };
	const layout: PaneNode = splitPane(pane, pane.id, 'column');

	// Stored like localStorage does
	const stored = JSON.stringify(layout);
	expect(parse(JSON.parse(stored))).toEqual(layout);
	expect(parse(undefined)).toBeUndefined();
	expect(parse({ kind: 'split', id: 'a', direction: 'row', ratio: 0.5, first: pane })).toBeUndefined();
	expect(parse({ kind: 'pane', id: 'a', widget: { config: {} } })).toEqual({ kind: 'pane', id: 'a' });
	expect(parse({ kind: 'split', id: 'a', direction: 'row', ratio: 2, first: pane, second: pane })).toMatchObject({
		ratio: 0.9,
	});
});

test('splitting stops at panes a quarter of the dashboard wide or tall', () => {
	const left = createPane();
	const right = createPane();
	const quarter = createPane();
	const layout = splitPane(splitPane(left, left.id, 'row', right), right.id, 'row', quarter);

	expect(canSplitPane(layout, right.id, 'row')).toBe(false);
	expect(canSplitPane(layout, quarter.id, 'row')).toBe(false);
	// Splitting the half makes 4 equal columns
	expect(canSplitPane(layout, left.id, 'row')).toBe(true);
	expect(canSplitPane(layout, quarter.id, 'column')).toBe(true);
});

test('layouts can be joined side by side unless either would end up with panes narrower than a quarter', () => {
	const single = createPane();
	const left = createPane();
	const columns = splitPane(left, left.id, 'row');
	const quarters = splitPane(columns, left.id, 'row');
	const top = createPane();
	const rows = splitPane(splitPane(top, top.id, 'column'), top.id, 'column');

	expect(canJoinLayouts(single, columns)).toBe(true);
	expect(canJoinLayouts(single, quarters)).toBe(false);
	expect(canJoinLayouts(quarters, single)).toBe(false);
	// Stacked panes don't make the joined panes narrower
	expect(canJoinLayouts(rows, single)).toBe(true);
	expect(joinLayouts(columns, single)).toMatchObject({ direction: 'row', ratio: 0.5, first: columns, second: single });
});

test('moving a pane puts it on that side of the target and its sibling takes its old space', () => {
	const [a, b, c] = [createPane(), createPane(), createPane()];
	// a | (b / c)
	const layout = splitPane(splitPane(a, a.id, 'row', b), b.id, 'column', c);

	// (c / a) | b
	expect(movePane(layout, c.id, a.id, 'top')).toMatchObject({
		direction: 'row',
		first: { direction: 'column', first: c, second: a },
		second: b,
	});
});

test("panes can't be moved onto themselves, out of a single pane layout, or where they'd be too narrow", () => {
	const [a, b, c, d] = [createPane(), createPane(), createPane(), createPane()];
	const halves = splitPane(a, a.id, 'row', b);
	// a | c | b | d
	const quarters = splitPane(splitPane(halves, a.id, 'row', c), b.id, 'row', d);

	expect(canMovePane(halves, a.id, a.id, 'left')).toBe(false);
	expect(canMovePane(a, a.id, a.id, 'left')).toBe(false);
	expect(canMovePane(halves, a.id, b.id, 'right')).toBe(true);
	// Taking d out leaves room beside b, but a's half is still full
	expect(canMovePane(quarters, d.id, b.id, 'left')).toBe(true);
	expect(canMovePane(quarters, d.id, a.id, 'left')).toBe(false);
	expect(canMovePane(quarters, d.id, a.id, 'top')).toBe(true);
	expect(movePane(quarters, d.id, a.id, 'left')).toBe(quarters);
});
