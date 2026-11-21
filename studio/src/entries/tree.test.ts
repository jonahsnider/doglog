import { expect, test } from 'vite-plus/test';
import { parseStructSpecification } from 'wpilog-parser';
import { DataSet } from '../data/data-set.ts';
import type { Entry } from '../data/data-store.ts';
import { Samples } from '../data/samples.ts';
import {
	ancestorGroups,
	buildEntryTree,
	collapseSearchGroups,
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

test('only /Robot, the Pinned section, or a lone top-level group start expanded', () => {
	const match = buildEntryTree(
		entries(
			'/Robot/Arm/Angle',
			'/Robot/Drive/Speed',
			'/RobotState/Mode',
			'/DS:joystick0/axes',
			'/NT:/Spot/Pose',
			'/DS:enabled',
		),
	);
	expect(expandedGroups(match, new Set())).toEqual(['/Robot']);

	// The user's own toggles are kept
	const toggled = toggledGroups(match, ['/DS:joystick0']);
	expect(expandedGroups(match, toggled)).toEqual(['/DS:joystick0']);

	// `/Robot` compacted with the only group in it
	const compacted = sectionEntryTree(buildEntryTree(entries('/Robot/Drive/Speed', '/Spot/Pose')), {}, false).items;
	expect(expandedGroups(compacted, new Set())).toEqual(['/Robot/Drive']);

	expect(expandedGroups(tree, new Set())).toEqual([]);
	const pinned = sectionEntryTree(tree, { '/Arm': 'pinned' }, false).items;
	expect(expandedGroups(pinned, new Set())).toEqual(['pinned', '/Drive']);
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

test('search can collapse one matching group without hiding other results', () => {
	const arms = buildEntryTree(entries('/LeftArm/Wrist/Angle', '/RightArm/Angle', '/RightArm/Velocity'));
	const results = entryTreeView(arms, [], 'angle');
	const collapsed = collapseSearchGroups(results, new Set(['/LeftArm/Wrist']));
	expect(collapsed.expanded).not.toContain('/LeftArm/Wrist');
	expect(collapsed.rows.map((row) => row.item.value)).toEqual(['/LeftArm/Wrist', '/RightArm', '/RightArm/Angle']);
	// The matching child is still in the tree, so expanding Wrist can show it again.
	expect(collapsed.items[0]?.children?.map((node) => node.value)).toEqual(['/LeftArm/Wrist/Angle']);
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

test('chains of groups with one group in them are one row, except the tops of pinned and hidden groups', () => {
	const modules = buildEntryTree(entries('/Drive/Modules/0', '/Drive/Modules/1', '/Time'));
	const rows = (placements: Record<string, 'pinned'>, query = '') => {
		const view = entryTreeView(
			sectionEntryTree(modules, placements, false).items,
			['pinned', '/Drive', '/Drive/Modules'],
			query,
		);
		return view.rows.map((row) => `${row.item.value} ${row.item.label}`);
	};

	expect(rows({})).toEqual(['/Drive/Modules Drive/Modules', '/Drive/Modules/0 0', '/Drive/Modules/1 1', '/Time Time']);
	expect(rows({ '/Drive': 'pinned' })).toEqual([
		'pinned Pinned',
		'/Drive /Drive',
		'/Drive/Modules Modules',
		'/Drive/Modules/0 0',
		'/Drive/Modules/1 1',
		'/Time Time',
	]);
	// Search leaves groups with fewer children, and highlights the segment of the chain that matched
	const results = buildEntryTree(entries('/Drive/Modules/0', '/Drive/Gyro'));
	const view = entryTreeView(sectionEntryTree(results, {}, false).items, [], 'modules');
	expect(view.rows.map((row) => `${row.item.value} ${row.item.label}`)).toEqual([
		'/Drive/Modules Drive/Modules',
		'/Drive/Modules/0 0',
	]);
	expect(view.highlights?.get('/Drive/Modules')).toEqual([6, 13]);
});

test('ancestor groups of entries', () => {
	expect([...ancestorGroups(['/Arm/Wrist/Angle', '/Arm/Velocity', '/Time'])]).toEqual(['/Arm', '/Arm/Wrist']);
});

/** Logged structs and arrays with their field entries */
function fieldEntries(): readonly Entry[] {
	const data = new DataSet(() => {});
	data.addEntry('/Arm/State', 'struct:ArmState');
	data.addEntry('/Drive/Pose', 'struct:Pose2d');
	const speeds = data.addEntry('/Drive/Speeds', 'double[]');
	data.addSample(speeds, 0, [1, 2]);
	data.addStructSchema('ArmState', parseStructSpecification('enum {STOWED=0, SCORING=1} int8 variant'));
	data.addStructSchema('Pose2d', parseStructSpecification('Translation2d translation; Rotation2d rotation'));
	data.addStructSchema('Translation2d', parseStructSpecification('double x; double y'));
	data.addStructSchema('Rotation2d', parseStructSpecification('double value'));
	data.publish();
	return data.snapshot.list;
}

test('structs with one field are one row showing the field, nested as deep as they go', () => {
	const fields = buildEntryTree(fieldEntries());
	const rows = entryTreeView(fields, ['/Arm', '/Drive', '/Drive/Pose'], '').rows.map(({ item }) => [
		item.value,
		item.field?.name,
	]);
	expect(rows).toEqual([
		['/Arm', undefined],
		['/Arm/State', '/Arm/State/variant'],
		['/Drive', undefined],
		['/Drive/Pose', undefined],
		['/Drive/Pose/rotation', '/Drive/Pose/rotation/value'],
		['/Drive/Pose/translation', undefined],
		['/Drive/Speeds', undefined],
	]);

	// Ex. editing a graph, which shows the enum's field but not its struct
	const numbers = buildEntryTree(fieldEntries().filter((entry) => entry.kind === 'number'));
	const state = numbers[0]!.children![0]!;
	expect(state).toMatchObject({ value: '/Arm/State/variant', label: 'State', entry: { name: '/Arm/State/variant' } });
	expect(state.children).toBeUndefined();
});

test("search doesn't list every field of a matching struct or array", () => {
	const fields = buildEntryTree(fieldEntries());
	const search = (query: string) => entryTreeView(fields, [], query).rows.map((row) => row.item.value);
	expect(search('speeds')).toEqual(['/Drive', '/Drive/Speeds']);
	expect(search('pose')).toEqual(['/Drive', '/Drive/Pose']);
	// `/Drive` is left with one group in it
	expect(search('speeds 1')).toEqual(['/Drive/Speeds', '/Drive/Speeds/1']);
	expect(search('pose x')).toEqual(['/Drive/Pose', '/Drive/Pose/translation', '/Drive/Pose/translation/x']);
});
