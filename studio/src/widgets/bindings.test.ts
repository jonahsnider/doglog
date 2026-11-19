import MapIcon from 'lucide-react/icons/map';
import { expect, test } from 'vite-plus/test';
import {
	addEntries,
	type Binding,
	connectBindings,
	disconnectBindings,
	dropEntry,
	removeBinding,
	resolveBindings,
	setBoundEntries,
	widgetBindings,
} from '@/widgets/bindings';
import type { Entry } from '@/data/data-store';
import { getEntryKind, Samples } from '@/data/samples';
import { createPane, findPane, type PaneNode } from '@/panes/layout';
import { getWidgetType } from '@/widgets/registry';
import type { WidgetType } from '@/widgets/widget-type';

const table = (...bindings: Binding[]) => ({ type: 'table', config: { bindings } });

const names = (layout: PaneNode, paneId: string) =>
	widgetBindings(findPane(layout, paneId)?.widget).map((binding) => binding.name);

function twoPanes(first: Binding[], second: Binding[]) {
	const left = { ...createPane(), widget: table(...first) };
	const right = { ...createPane(), widget: table(...second) };
	const layout: PaneNode = { kind: 'split', id: 'split', direction: 'row', children: [left, right] };
	return { layout, left: left.id, right: right.id };
}

const a = { id: 'a', name: '/a' };
const b = { id: 'b', name: '/b' };
const c = { id: 'c', name: '/c' };

test("dropping a binding onto another in its widget takes that binding's position", () => {
	const { layout, left } = twoPanes([a, b, c], []);
	const drop = (binding: Binding, index: number) =>
		names(
			dropEntry(layout, { name: binding.name, from: { paneId: left, bindingId: binding.id } }, { paneId: left, index }),
			left,
		);

	expect(drop(a, 2)).toEqual(['/b', '/c', '/a']);
	expect(drop(c, 0)).toEqual(['/c', '/a', '/b']);
	expect(drop(b, 1)).toEqual(['/a', '/b', '/c']);
});

test('dropping a binding from another pane moves it with its role', () => {
	const ghost = { id: 'ghost', name: '/a', role: 'ghost' };
	const { layout, left, right } = twoPanes([ghost, b], [c]);

	const moved = dropEntry(
		layout,
		{ name: '/a', from: { paneId: left, bindingId: 'ghost' } },
		{ paneId: right, index: 0 },
	);

	expect(names(moved, left)).toEqual(['/b']);
	expect(widgetBindings(findPane(moved, right)?.widget)).toEqual([ghost, c]);
});

test('dropping on a part of a widget with a role gives the entry that role', () => {
	const { layout, left } = twoPanes([a, b], []);

	const moved = dropEntry(
		layout,
		{ name: '/b', from: { paneId: left, bindingId: 'b' } },
		{ paneId: left, role: 'right' },
	);
	expect(widgetBindings(findPane(moved, left)?.widget)).toEqual([a, { ...b, role: 'right' }]);

	const added = dropEntry(layout, { name: '/c' }, { paneId: left, index: 0, role: 'discrete' });
	expect(widgetBindings(findPane(added, left)?.widget)[0]).toMatchObject({ name: '/c', role: 'discrete' });
});

test('an entry the widget already shows can be dropped again', () => {
	const { layout, left, right } = twoPanes([a], [a]);

	expect(names(dropEntry(layout, { name: '/a' }, { paneId: right }), right)).toEqual(['/a', '/a']);
	const moved = dropEntry(layout, { name: '/a', from: { paneId: left, bindingId: 'a' } }, { paneId: right });
	expect(names(moved, left)).toEqual([]);
});

test('entries dropped on an empty pane stay where they are', () => {
	const leftPane = { ...createPane(), widget: table(a) };
	const emptyPane = createPane();
	const empty: PaneNode = { kind: 'split', id: 'split', direction: 'row', children: [leftPane, emptyPane] };

	expect(
		dropEntry(empty, { name: '/a', from: { paneId: leftPane.id, bindingId: 'a' } }, { paneId: emptyPane.id }),
	).toBe(empty);
});

test('adding entries skips ones the widget already shows', () => {
	const { layout, left } = twoPanes([a], []);

	expect(addEntries(layout, left, ['/a'])).toBe(layout);
	expect(names(addEntries(layout, left, ['/a', '/b']), left)).toEqual(['/a', '/b']);
});

test('setting the bound entries removes every binding of the others', () => {
	const { layout, left } = twoPanes([a, b, { id: 'a2', name: '/a' }], []);

	expect(names(setBoundEntries(layout, left, ['/b', '/c']), left)).toEqual(['/b', '/c']);
	expect(names(setBoundEntries(layout, left, ['/a']), left)).toEqual(['/a', '/a']);
});

const pose: Entry = {
	name: '/pose',
	type: 'struct:Pose2d',
	kind: getEntryKind('struct:Pose2d'),
	samples: new Samples(),
	metadata: {},
};
const robotType: WidgetType = {
	id: 'robots',
	name: 'Robots',
	icon: MapIcon,
	hotkey: 'R',
	accepts: ['struct'],
	roles: () => [
		{ id: 'robot', label: 'Robot' },
		{ id: 'ghost', label: 'Ghost' },
	],
	component: () => null,
};
const roles = (...bindings: Binding[]) =>
	resolveBindings(robotType, bindings, (name) => (name === pose.name ? pose : undefined)).map(
		(binding) => binding.role?.id,
	);

test('another binding of an entry infers a role the others do not have', () => {
	expect(roles({ id: '1', name: '/pose' }, { id: '2', name: '/pose' })).toEqual(['robot', 'ghost']);
	// Picked roles are taken first, even by later bindings
	expect(roles({ id: '1', name: '/pose' }, { id: '2', name: '/pose', role: 'robot' })).toEqual(['ghost', 'robot']);
	// Hidden bindings keep their role
	expect(roles({ id: '1', name: '/pose', hidden: true }, { id: '2', name: '/pose' })).toEqual(['robot', 'ghost']);
	// Once every role is taken, the inferred one is used again
	expect(roles(...['1', '2', '3'].map((id) => ({ id, name: '/pose' })))).toEqual(['robot', 'ghost', 'robot']);
});

test("a picked role that doesn't fit is ignored", () => {
	expect(roles({ id: '1', name: '/pose', role: 'path' })).toEqual(['robot']);
});

const labels = (type: WidgetType, ...bindings: Binding[]) =>
	resolveBindings(type, bindings, () => pose).map((binding) => binding.roleLabel);

test('roles are labeled when there is a choice or the entry is bound more than once', () => {
	const singleRole: WidgetType = { ...robotType, roles: () => [{ id: 'robot', label: 'Robot' }] };

	expect(labels(robotType, a)).toEqual(['Robot']);
	expect(labels(singleRole, a)).toEqual([undefined]);
	expect(labels(singleRole, a, { id: 'a2', name: '/a' })).toEqual(['Robot', 'Robot']);
});

const field = getWidgetType('field')!;
const fieldEntries = new Map<string, Entry>(
	(
		[
			['/pose', 'struct:Pose2d'],
			['/setpoint', 'struct:Pose2d'],
			['/tags', 'struct:Pose3d[]'],
			['/path', 'struct:Pose2d[]'],
		] as const
	).map(([name, type]) => [name, { name, type, kind: getEntryKind(type), samples: new Samples(), metadata: {} }]),
);
const resolveField = (...bindings: Binding[]) => resolveBindings(field, bindings, (name) => fieldEntries.get(name));

test('the first pose on the field is a robot and later ones are ghosts', () => {
	expect(
		resolveField(
			{ id: '1', name: '/tags' },
			{ id: '2', name: '/pose', hidden: true },
			{ id: '3', name: '/setpoint' },
		).map((binding) => binding.role?.id),
	).toEqual(['points', 'robot', 'ghost']);
});

test('only single positions are drawn from', () => {
	const tags = resolveField(
		{ id: 'p', name: '/pose' },
		{ id: 'path', name: '/path' },
		{ id: 't', name: '/tags', sources: ['p', 'path', 'gone'] },
	)[2]!;
	expect(tags.sources.map((source) => source.id)).toEqual(['p']);
});

test('connecting skips bindings that are already connected either way', () => {
	const { layout, left } = twoPanes([a, b], []);
	const connected = connectBindings(layout, left, 'a', 'b');

	expect(widgetBindings(findPane(connected, left)?.widget)[1]?.sources).toEqual(['a']);
	expect(connectBindings(connected, left, 'a', 'b')).toBe(connected);
	expect(connectBindings(connected, left, 'b', 'a')).toBe(connected);
	expect(connectBindings(layout, left, 'a', 'a')).toBe(layout);
	expect(
		widgetBindings(findPane(disconnectBindings(connected, left, 'a', 'b'), left)?.widget)[1]?.sources,
	).toBeUndefined();
});

const sources = (layout: PaneNode, paneId: string) =>
	widgetBindings(findPane(layout, paneId)?.widget).map((binding) => binding.sources);

test('connections are removed with either end', () => {
	const { layout, left, right } = twoPanes([a, { ...b, sources: ['a'] }, { ...c, sources: ['b'] }], []);

	expect(sources(removeBinding(layout, left, 'a'), left)).toEqual([undefined, ['b']]);
	// Moved bindings are connected to bindings in the widget they came from
	const moved = dropEntry(layout, { name: '/b', from: { paneId: left, bindingId: 'b' } }, { paneId: right });
	expect(sources(moved, left)).toEqual([undefined, undefined]);
	expect(sources(moved, right)).toEqual([undefined]);
});
