import { MapIcon } from 'lucide-react';
import { expect, test } from 'vite-plus/test';
import { addEntries, type Binding, dropEntry, resolveBindings, setBoundEntries, widgetBindings } from '@/bindings';
import type { Entry } from '@/data/data-store';
import { getEntryKind, Samples } from '@/data/samples';
import { createPane, findPane, type PaneNode } from '@/pane-layout';
import type { WidgetType } from '@/widgets/widget-type';

const table = (...bindings: Binding[]) => ({ type: 'values-table', config: { bindings } });

const names = (layout: PaneNode, paneId: string) =>
	widgetBindings(findPane(layout, paneId)?.widget).map((binding) => binding.name);

function twoPanes(first: Binding[], second: Binding[]) {
	const left = { ...createPane(), widget: table(...first) };
	const right = { ...createPane(), widget: table(...second) };
	const layout: PaneNode = { kind: 'split', id: 'split', direction: 'row', ratio: 0.5, first: left, second: right };
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

test('an entry the widget already shows can be dropped again', () => {
	const { layout, left, right } = twoPanes([a], [a]);

	expect(names(dropEntry(layout, { name: '/a' }, { paneId: right }), right)).toEqual(['/a', '/a']);
	const moved = dropEntry(layout, { name: '/a', from: { paneId: left, bindingId: 'a' } }, { paneId: right });
	expect(names(moved, left)).toEqual([]);
});

test('entries dropped on an empty pane stay where they are', () => {
	const { layout, left } = twoPanes([a], []);
	const empty: PaneNode = { ...layout, second: createPane() };
	const emptyId = (empty as { second: { id: string } }).second.id;

	expect(dropEntry(empty, { name: '/a', from: { paneId: left, bindingId: 'a' } }, { paneId: emptyId })).toBe(empty);
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
