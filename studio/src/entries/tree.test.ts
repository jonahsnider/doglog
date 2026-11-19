import { expect, test } from 'vite-plus/test';
import type { Entry } from '../data/data-store.ts';
import { Samples } from '../data/samples.ts';
import {
	ancestorGroups,
	buildEntryTree,
	entryTreeView,
	expandedGroups,
	sectionEntryTree,
	toggledGroups,
} from './tree.ts';

function entries(...names: string[]): Entry[] {
	return names.map((name) => ({ name, type: 'double', kind: 'number', samples: new Samples(), metadata: {} }));
}

const tree = buildEntryTree(
	entries('/Arm', '/Arm/Angle', '/Arm/Velocity', '/Drive/Module10', '/Drive/Module2', '/Time'),
);

function paths(expanded: string[], query = ''): string[] {
	return entryTreeView(tree, expanded, query).rows.map((row) => row.item.value);
}

test('entries are grouped by path segment and collapsed groups hide their children', () => {
	expect(paths([])).toEqual(['/Arm', '/Drive', '/Time']);
	expect(paths(['/Arm'])).toEqual(['/Arm', '/Arm/Angle', '/Arm/Velocity', '/Drive', '/Time']);
});

test('top-level groups start expanded until the user collapses them', () => {
	expect(expandedGroups(tree, new Set())).toEqual(['/Arm', '/Drive']);

	const collapsed = toggledGroups(tree, ['/Drive']);
	expect(expandedGroups(tree, collapsed)).toEqual(['/Drive']);

	// A group that appears later, ex. from a live source, starts expanded too
	const later = buildEntryTree(entries('/Arm/Angle', '/Drive/Module2', '/Vision/Pose'));
	expect(expandedGroups(later, collapsed)).toEqual(['/Drive', '/Vision']);
});

test('a name can be both an entry and a group', () => {
	const arm = tree[0]!;
	expect(arm.entry?.name).toBe('/Arm');
	expect(arm.children?.map((node) => node.label)).toEqual(['Angle', 'Velocity']);
});

test('numbers in names sort naturally', () => {
	expect(paths(['/Drive'])).toEqual(['/Arm', '/Drive', '/Drive/Module2', '/Drive/Module10', '/Time']);
});

test('search shows matching entries and their parent groups, expanded', () => {
	const view = entryTreeView(tree, [], 'velocity');
	expect(view.rows.map((row) => row.item.value)).toEqual(['/Arm', '/Arm/Velocity']);
	expect(view.expanded).toEqual(['/Arm']);
	expect(view.rows.map((row) => row.level)).toEqual([1, 2]);
});

test('search matches the full name', () => {
	expect(paths([], 'drive/module')).toEqual(['/Drive', '/Drive/Module2', '/Drive/Module10']);
	expect(paths([], 'nothing')).toEqual([]);
});

test('search ignores separators', () => {
	expect(paths([], 'drivemodule2')).toEqual(['/Drive', '/Drive/Module2']);
	expect(paths([], 'ArmVelocity')).toEqual(['/Arm', '/Arm/Velocity']);

	const styles = buildEntryTree(entries('/Swerve/module_states', '/Swerve/Module States', '/Swerve/module-states'));
	const view = entryTreeView(styles, [], 'modulestates');
	expect(view.rows.map((row) => row.item.value)).toEqual([
		'/Swerve',
		'/Swerve/Module States',
		'/Swerve/module_states',
		'/Swerve/module-states',
	]);
	// Separators inside a match aren't highlighted
	expect(view.highlights?.get('/Swerve/module_states')).toEqual([0, 6, 7, 13]);
});

test('search matches struct types but not primitive types', () => {
	const typed = buildEntryTree([
		{ name: '/Drive/Pose', type: 'struct:Pose2d', kind: 'struct', samples: new Samples(), metadata: {} },
		{ name: '/Drive/Enabled', type: 'boolean', kind: 'boolean', samples: new Samples(), metadata: {} },
	]);
	const search = (query: string) => entryTreeView(typed, [], query).rows.map((row) => row.item.value);
	expect(search('pose2d')).toEqual(['/Drive', '/Drive/Pose']);
	expect(search('boolean')).toEqual([]);
	// The type isn't shown, so it isn't highlighted
	expect(entryTreeView(typed, [], 'pose2d').highlights?.get('/Drive/Pose')).toBeUndefined();
});

test('search matches abbreviations', () => {
	expect(paths([], 'armvel')).toEqual(['/Arm', '/Arm/Velocity']);
	expect(paths([], 'mod10')).toEqual(['/Drive', '/Drive/Module10']);
});

test('search without letters or numbers shows the whole tree', () => {
	expect(paths([], '/')).toEqual(['/Arm', '/Drive', '/Time']);
});

test('search highlights the matching parts of each label, including groups', () => {
	const { highlights } = entryTreeView(tree, [], 'arm vel');
	expect(highlights?.get('/Arm')).toEqual([0, 3]);
	expect(highlights?.get('/Arm/Velocity')).toEqual([0, 3]);
});

function sectionPaths(placements: Record<string, 'pinned' | 'hidden'>, expanded: string[], query = ''): string[] {
	const { items, hidden } = sectionEntryTree(tree, placements, false);
	return [...entryTreeView(items, expanded, query).rows, ...entryTreeView(hidden, expanded, query, 'hidden').rows].map(
		(row) => `${row.section} ${row.item.value}`,
	);
}

test('pinned and hidden entries move out of their groups into their own sections', () => {
	expect(sectionPaths({ '/Arm/Angle': 'pinned', '/Time': 'hidden' }, ['pinned', '/Arm'])).toEqual([
		'pinned pinned',
		'pinned /Arm/Angle',
		'main /Arm',
		'main /Arm/Velocity',
		'main /Drive',
		'hidden /Time',
	]);
});

test('empty groups and an empty Pinned section are left out', () => {
	expect(sectionPaths({ '/Drive/Module2': 'hidden', '/Drive/Module10': 'hidden' }, [])).toEqual([
		'main /Arm',
		'main /Time',
		'hidden /Drive/Module2',
		'hidden /Drive/Module10',
	]);
	expect(sectionEntryTree(tree, {}, true).items.map((node) => node.value)).toEqual([
		'pinned',
		'/Arm',
		'/Drive',
		'/Time',
	]);
});

test('groups keep their entries when pinned or hidden, unless they are moved out on their own', () => {
	expect(sectionPaths({ '/Arm': 'hidden', '/Arm/Angle': 'pinned' }, ['pinned', '/Arm'])).toEqual([
		'pinned pinned',
		'pinned /Arm/Angle',
		'main /Drive',
		'main /Time',
		'hidden /Arm',
		'hidden /Arm/Velocity',
	]);
});

test('search shows hidden matches and highlights full paths', () => {
	const { hidden } = sectionEntryTree(tree, { '/Arm/Velocity': 'hidden' }, false);
	const view = entryTreeView(hidden, [], 'arm vel', 'hidden');
	expect(view.rows.map((row) => row.item.value)).toEqual(['/Arm/Velocity']);
	expect(view.highlights?.get('/Arm/Velocity')).toEqual([1, 4, 5, 8]);
});

test('ancestor groups of entries', () => {
	expect([...ancestorGroups(['/Arm/Wrist/Angle', '/Arm/Velocity', '/Time'])]).toEqual(['/Arm', '/Arm/Wrist']);
});
