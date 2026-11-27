import { expect, test } from 'vite-plus/test';
import { widgetBindings } from '@/widgets/bindings';
import {
	canJoinLayouts,
	canMovePane,
	canSplitPane,
	closePane,
	createPane,
	joinLayouts,
	movePane,
	paneAfterClosing,
	panes,
	panesAlong,
	type PaneNode,
	paneNodeSchema,
	resetDivider,
	resizeSplit,
	setPaneWidget,
	type Split,
	splitPane,
} from './layout.ts';
import { restoreLayout, snapshotLayout } from './layout-snapshot.ts';
import { childSizes } from './split-sizes.ts';

const graph = { type: 'line-graph', config: { bindings: [{ id: 'arm', name: '/Arm/Angle' }] } };

function expectSplit(node: PaneNode | undefined): Split {
	if (node?.kind !== 'split') {
		throw new Error(`Expected a split, got ${node?.kind}`);
	}
	return node;
}

const parse = (stored: unknown) => paneNodeSchema.safeParse(stored).data;

const sizesOf = (node: PaneNode) => childSizes(expectSplit(node));
const shares = (...sizes: number[]) => sizes.map((size): unknown => expect.closeTo(size) as unknown);

test('splitting a pane keeps it first and adds an empty pane after it', () => {
	const original = { ...createPane(), widget: graph };

	const layout = expectSplit(splitPane(original, original.id, 'row'));

	expect(layout).toMatchObject({ kind: 'split', direction: 'row', children: [original, { kind: 'pane' }] });
	expect(layout.children[1]).not.toHaveProperty('widget');
	expect(sizesOf(layout)).toEqual(shares(0.5, 0.5));
});

test('splitting a pane again in the same direction lines up equal panes', () => {
	const first = createPane();
	let layout: PaneNode = first;
	let last = first;
	for (let count = 0; count < 3; count++) {
		const next = createPane();
		layout = splitPane(layout, last.id, 'row', next);
		last = next;
	}

	const split = expectSplit(layout);
	expect(split.children).toHaveLength(4);
	expect(sizesOf(split)).toEqual(shares(0.25, 0.25, 0.25, 0.25));
});

test('splitting a resized pane shares its size with the new pane', () => {
	const [left, right, added] = [createPane(), createPane(), createPane()];
	const halves = expectSplit(splitPane(left, left.id, 'row', right));
	const resized = resizeSplit(halves, halves.id, [2 / 3, 1 / 3]);

	expect(sizesOf(splitPane(resized, right.id, 'row', added))).toEqual(shares(2 / 3, 1 / 6, 1 / 6));
});

test('splitting a pane the other way nests a split in its place', () => {
	const [left, right, below] = [createPane(), createPane(), createPane()];
	const halves = splitPane(left, left.id, 'row', right);

	expect(splitPane(halves, right.id, 'column', below)).toMatchObject({
		direction: 'row',
		children: [left, { kind: 'split', direction: 'column', children: [right, below] }],
	});
});

test('closing a pane lets the panes beside it take its space', () => {
	const [a, b, c] = [createPane(), createPane(), createPane()];
	const thirds = splitPane(splitPane(a, a.id, 'row', b), b.id, 'row', c);

	expect(sizesOf(closePane(thirds, b.id))).toEqual(shares(0.5, 0.5));

	const nested = splitPane(splitPane(a, a.id, 'row', b), b.id, 'column', c);
	expect(closePane(nested, c.id)).toMatchObject({ direction: 'row', children: [a, b] });
	expect(closePane(closePane(nested, c.id), b.id)).toEqual(a);
});

test('closing a pane between resized panes scales them up to fill the split', () => {
	const [a, b, c] = [createPane(), createPane(), createPane()];
	const thirds = expectSplit(splitPane(splitPane(a, a.id, 'row', b), b.id, 'row', c));
	const resized = resizeSplit(thirds, thirds.id, [0.5, 0.25, 0.25]);

	expect(sizesOf(closePane(resized, c.id))).toEqual(shares(2 / 3, 1 / 3));
});

test('closing a pane whose split is left inside one in the same direction moves its panes up', () => {
	const [a, b, c, d] = [createPane(), createPane(), createPane(), createPane()];
	// a | ((b | c) / d)
	const layout = splitPane(splitPane(splitPane(a, a.id, 'row', b), b.id, 'column', d), b.id, 'row', c);

	const closed = expectSplit(closePane(layout, d.id));
	expect(closed.children.map((child) => child.id)).toEqual([a.id, b.id, c.id]);
	expect(sizesOf(closed)).toEqual(shares(0.5, 0.25, 0.25));
});

test('the pane focused after closing one is beside it, or before it in reading order when shown one at a time', () => {
	const [a, b, c] = [createPane(), createPane(), createPane()];
	const layout = splitPane(splitPane(a, a.id, 'row', b), b.id, 'column', c);
	expect(paneAfterClosing(layout, b.id, false)).toEqual(c);
	expect(paneAfterClosing(layout, c.id, false)).toEqual(b);
	expect(paneAfterClosing(layout, b.id, true)).toEqual(a);
	expect(paneAfterClosing(layout, a.id, true)).toEqual(b);
	expect(paneAfterClosing(a, a.id, false)).toBeUndefined();
});

test('closing the only pane leaves an empty pane', () => {
	const pane = { ...createPane(), widget: graph };

	const layout = closePane(pane, pane.id);

	expect(layout.kind).toBe('pane');
	expect(layout).not.toHaveProperty('widget');
});

test('setting and clearing a nested pane widget', () => {
	const [top, bottom] = [createPane(), createPane()];
	const split = splitPane(top, top.id, 'column', bottom);

	const withWidget = setPaneWidget(split, bottom.id, graph);
	expect(withWidget).toMatchObject({ children: [top, { id: bottom.id, widget: graph }] });

	expect(setPaneWidget(withWidget, bottom.id, undefined)).toEqual(split);
});

test('resizing keeps the sizes of the panes that changed, and the rest share what is left', () => {
	const [a, b, c] = [createPane(), createPane(), createPane()];
	const thirds = expectSplit(splitPane(splitPane(a, a.id, 'row', b), b.id, 'row', c));

	const resized = expectSplit(resizeSplit(thirds, thirds.id, [0.5, 1 / 6, 1 / 3]));
	expect(resized.children.map((child) => child.size)).toEqual([0.5, 1 / 6, undefined]);

	// Closing the unsized pane gives its space to the others in proportion
	expect(sizesOf(closePane(resized, c.id))).toEqual(shares(0.75, 0.25));
});

test('resizing close to an even split snaps back to it', () => {
	const [a, b] = [createPane(), createPane()];
	const halves = expectSplit(splitPane(a, a.id, 'row', b));

	expect(expectSplit(resizeSplit(halves, halves.id, [0.51, 0.49], 0.02)).children).toEqual([a, b]);
	expect(expectSplit(resizeSplit(halves, halves.id, [0.6, 0.4], 0.02)).children.map((child) => child.size)).toEqual([
		0.6, 0.4,
	]);
});

test('resetting a divider lets the panes beside it share their space evenly', () => {
	const [a, b, c] = [createPane(), createPane(), createPane()];
	const thirds = expectSplit(splitPane(splitPane(a, a.id, 'row', b), b.id, 'row', c));
	const resized = resizeSplit(thirds, thirds.id, [0.5, 0.25, 0.25]);

	expect(sizesOf(resetDivider(resized, thirds.id, 1))).toEqual(shares(0.5, 0.25, 0.25));
	expect(sizesOf(resetDivider(resized, thirds.id, 0))).toEqual(shares(0.375, 0.375, 0.25));
});

test('parsing round-trips valid layouts and fixes or rejects invalid ones', () => {
	const pane = { ...createPane(), widget: graph };
	const layout = splitPane(pane, pane.id, 'column');

	expect(parse(structuredClone(layout))).toEqual(layout);
	expect(parse(undefined)).toBeUndefined();
	expect(parse({ kind: 'split', id: 'a', direction: 'row', children: [] })).toBeUndefined();
	expect(parse({ kind: 'split', id: 'a', direction: 'row', children: [pane] })).toEqual(pane);
	expect(parse({ kind: 'pane', id: 'a', widget: { config: {} } })).toEqual({ kind: 'pane', id: 'a' });
	expect(parse({ kind: 'pane', id: 'a', size: 2 })).toEqual({ kind: 'pane', id: 'a' });
});

test('layout snapshots omit IDs and restore binding connections to fresh IDs', () => {
	const options = { orientation: 'red-left' };
	const widget = {
		type: 'field',
		config: {
			options,
			bindings: [
				{ id: 'robot', name: '/Drive/Pose' },
				{ id: 'ghost', name: '/Drive/Pose', role: 'ghost', color: 2 },
				{ id: 'tags', name: '/Vision/Tags', hidden: true, sources: ['ghost'] },
			],
		},
	};
	const row = splitPane({ kind: 'pane', id: 'empty' }, 'empty', 'row', { kind: 'pane', id: 'field', widget });
	const layout = resizeSplit(row, row.id, [0.3, 0.7]);

	const snapshot = snapshotLayout(layout);
	expect(snapshot).toEqual({
		kind: 'split',
		direction: 'row',
		children: [
			{ kind: 'pane', size: 0.3 },
			{
				kind: 'pane',
				size: 0.7,
				widget: {
					type: 'field',
					config: { options },
					bindings: [
						{ name: '/Drive/Pose' },
						{ name: '/Drive/Pose', role: 'ghost', color: 2 },
						{ name: '/Vision/Tags', hidden: true, connectedFrom: [1] },
					],
				},
			},
		],
	});

	const restored = restoreLayout(snapshot);
	const [empty, field] = panes(restored);
	const [robot, ghost, tags] = widgetBindings(field?.widget);
	const ids = [restored.id, empty?.id, field?.id, robot?.id, ghost?.id, tags?.id];
	expect(ids).not.toContain(undefined);
	expect(new Set([...ids, layout.id, 'empty', 'field', 'robot', 'ghost', 'tags']).size).toBe(12);
	expect(tags?.sources).toEqual([ghost?.id]);
	expect(snapshotLayout(restored)).toEqual(snapshot);
});

test('splitting stops at 4 panes in a row or column', () => {
	const [a, b, c, d] = [createPane(), createPane(), createPane(), createPane()];
	const thirds = splitPane(splitPane(a, a.id, 'row', b), b.id, 'row', c);
	const quarters = splitPane(thirds, c.id, 'row', d);

	expect(canSplitPane(thirds, c.id, 'row')).toBe(true);
	expect(canSplitPane(quarters, a.id, 'row')).toBe(false);
	expect(canSplitPane(quarters, a.id, 'column')).toBe(true);
	expect(canSplitPane(quarters, 'missing', 'column')).toBe(false);
});

test('panes along a direction count nested splits across the whole layout', () => {
	const [left, right, bottom] = [createPane(), createPane(), createPane()];
	// Left half, right half split into a top pane and a bottom pane split into two columns
	const layout = splitPane(
		splitPane(splitPane(left, left.id, 'row', right), right.id, 'column', bottom),
		bottom.id,
		'row',
	);

	expect(panesAlong(layout, 'row')).toBe(3);
	expect(panesAlong(layout, 'column')).toBe(2);
});

test('joined layouts each take an equal share of the width, unless panes would end up narrower than a quarter', () => {
	const [single, left, top] = [createPane(), createPane(), createPane()];
	const columns = splitPane(left, left.id, 'row');
	const quarters = splitPane(splitPane(columns, left.id, 'row'), left.id, 'row');
	const rows = splitPane(top, top.id, 'column');

	expect(canJoinLayouts([single, columns])).toBe(true);
	expect(canJoinLayouts([single, quarters])).toBe(false);
	// Stacked panes don't make the joined panes narrower
	expect(canJoinLayouts([rows, single])).toBe(true);
	expect(canJoinLayouts([single, createPane(), createPane(), createPane()])).toBe(true);
	expect(canJoinLayouts([single, createPane(), createPane(), createPane(), createPane()])).toBe(false);

	expect(joinLayouts([rows, single])).toMatchObject({ direction: 'row', children: [rows, single] });
	// The columns' panes are moved up into the joined row, keeping half of the width between them
	expect(sizesOf(joinLayouts([columns, single]))).toEqual(shares(0.25, 0.25, 0.5));
});

test('moving a pane puts it on that side of the target and the panes around its old place take its space', () => {
	const [a, b, c] = [createPane(), createPane(), createPane()];
	// a | (b / c)
	const layout = splitPane(splitPane(a, a.id, 'row', b), b.id, 'column', c);

	// (c / a) | b
	expect(movePane(layout, c.id, a.id, 'top')).toMatchObject({
		direction: 'row',
		children: [{ direction: 'column', children: [c, a] }, b],
	});
	// c | a | b
	expect(movePane(layout, c.id, a.id, 'left')).toMatchObject({ direction: 'row', children: [c, a, b] });
});

test("panes can't be moved onto themselves, out of a single pane layout, or where they'd be too narrow", () => {
	const [a, b, c, d, e] = [createPane(), createPane(), createPane(), createPane(), createPane()];
	const halves = splitPane(a, a.id, 'row', b);
	// a | b | c | d, then e below d
	const quarters = splitPane(splitPane(splitPane(halves, b.id, 'row', c), c.id, 'row', d), d.id, 'column', e);

	expect(canMovePane(halves, a.id, a.id, 'left')).toBe(false);
	expect(canMovePane(a, a.id, a.id, 'left')).toBe(false);
	expect(canMovePane(halves, a.id, b.id, 'right')).toBe(true);
	expect(canMovePane(quarters, e.id, a.id, 'left')).toBe(false);
	expect(canMovePane(quarters, e.id, a.id, 'top')).toBe(true);
	// Taking c out of the row leaves room for it below e
	expect(canMovePane(quarters, c.id, e.id, 'bottom')).toBe(true);
	expect(movePane(quarters, e.id, a.id, 'left')).toBe(quarters);
});
