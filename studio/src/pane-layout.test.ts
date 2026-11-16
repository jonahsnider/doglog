import { expect, test } from 'vite-plus/test';
import {
	canSplitPane,
	closePane,
	createPane,
	findSibling,
	type PaneNode,
	paneNodeSchema,
	resizeSplit,
	setPaneWidget,
	type Split,
	splitPane,
} from './pane-layout.ts';

const graph = { type: 'line-graph', config: { entryNames: ['/Arm/Angle'] } };

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
