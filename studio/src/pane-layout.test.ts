import { expect, test } from 'vite-plus/test';
import {
	closePane,
	createPane,
	type PaneNode,
	paneNodeSchema,
	resizeSplit,
	setPaneWidget,
	splitPane,
} from './pane-layout.ts';

const graph = { type: 'line-graph', config: { entries: ['/Arm/Angle'] } };

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
	expect(layout.kind === 'split' && layout.second.kind === 'pane' && layout.second.widget).toBeFalsy();
});

test('closing a pane lets its sibling take its place', () => {
	const left = { ...createPane(), widget: graph };
	const split = splitPane(left, left.id, 'row');
	const right = split.kind === 'split' ? split.second : split;
	const nested = splitPane(split, right.id, 'column');

	// Closing the bottom right pane collapses the nested split back to the original
	const bottomRight = nested.kind === 'split' && nested.second.kind === 'split' ? nested.second.second : nested;
	expect(closePane(nested, bottomRight.id)).toEqual(split);

	expect(closePane(split, right.id)).toEqual(left);
});

test('closing the only pane leaves an empty pane', () => {
	const pane = { ...createPane(), widget: graph };

	const layout = closePane(pane, pane.id);

	expect(layout.kind).toBe('pane');
	expect(layout.kind === 'pane' && layout.widget).toBeUndefined();
});

test('setting and clearing a nested pane widget', () => {
	const first = createPane();
	const split = splitPane(first, first.id, 'column');
	const second = split.kind === 'split' ? split.second : split;

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

	const parse = (stored: unknown) => paneNodeSchema.safeParse(stored).data;

	expect(parse(JSON.parse(JSON.stringify(layout)))).toEqual(layout);
	expect(parse(undefined)).toBeUndefined();
	expect(parse({ kind: 'split', id: 'a', direction: 'row', ratio: 0.5, first: pane })).toBeUndefined();
	expect(parse({ kind: 'pane', id: 'a', widget: { config: {} } })).toEqual({ kind: 'pane', id: 'a' });
	expect(parse({ kind: 'split', id: 'a', direction: 'row', ratio: 2, first: pane, second: pane })).toMatchObject({
		ratio: 0.9,
	});
});
