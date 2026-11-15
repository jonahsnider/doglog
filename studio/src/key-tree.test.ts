import { expect, test } from 'vite-plus/test';
import type { Entry } from './data/data-store.ts';
import { Samples } from './data/samples.ts';
import { buildKeyTree, visibleKeyRows } from './key-tree.ts';

function entries(...names: string[]): Entry[] {
	return names.map((name) => ({ name, type: 'double', kind: 'number', samples: new Samples() }));
}

const tree = buildKeyTree(entries('/Arm', '/Arm/Angle', '/Arm/Velocity', '/Drive/Module10', '/Drive/Module2', '/Time'));

function paths(expanded: string[], query = ''): string[] {
	return visibleKeyRows(tree, new Set(expanded), query).map((row) => row.node.path);
}

test('entries are grouped by path segment and collapsed groups hide their children', () => {
	expect(paths([])).toEqual(['/Arm', '/Drive', '/Time']);
	expect(paths(['/Arm'])).toEqual(['/Arm', '/Arm/Angle', '/Arm/Velocity', '/Drive', '/Time']);
});

test('a name can be both an entry and a group', () => {
	const arm = tree[0]!;
	expect(arm.entry?.name).toBe('/Arm');
	expect(arm.children.map((node) => node.label)).toEqual(['Angle', 'Velocity']);
});

test('numbers in names sort naturally', () => {
	expect(paths(['/Drive'])).toEqual(['/Arm', '/Drive', '/Drive/Module2', '/Drive/Module10', '/Time']);
});

test('search shows matching entries and their parent groups, expanded', () => {
	const rows = visibleKeyRows(tree, new Set(), 'velocity');
	expect(rows.map((row) => row.node.path)).toEqual(['/Arm', '/Arm/Velocity']);
	expect(rows[0]?.expanded).toBe(true);
	expect(rows.map((row) => row.depth)).toEqual([0, 1]);
});

test('search matches the full name', () => {
	expect(paths([], 'drive/module')).toEqual(['/Drive', '/Drive/Module2', '/Drive/Module10']);
	expect(paths([], 'nothing')).toEqual([]);
});

test('search tolerates typos', () => {
	expect(paths([], 'velcoity')).toEqual(['/Arm', '/Arm/Velocity']);
	expect(paths([], 'velocty')).toEqual(['/Arm', '/Arm/Velocity']);
});

test('search without letters or numbers shows the whole tree', () => {
	expect(paths([], '/')).toEqual(['/Arm', '/Drive', '/Time']);
});

test('search highlights the matching parts of each label', () => {
	const rows = visibleKeyRows(tree, new Set(), 'arm vel');
	expect(rows.map((row) => [row.node.path, row.highlights])).toEqual([
		['/Arm', undefined],
		['/Arm/Velocity', [0, 3]],
	]);
});
