import { expect, test } from 'vite-plus/test';
import { checkBinding, createInputLayout, describeLayout } from '@/agent/layouts';
import type { LayoutInput } from '@/agent/schemas';
import type { Entry } from '@/data/data-store';
import { createSamples, getEntryKind } from '@/data/samples';
import { panes, type PaneNode } from '@/panes/layout';
import { getWidgetType } from '@/widgets/registry';
import { widgetBindings } from '@/widgets/bindings';

const entries = new Map(
	(
		[
			['/Drive/Pose', 'struct:Pose2d'],
			['/Drive/Setpoint', 'struct:Pose2d'],
			['/Vision/Tags', 'struct:Pose3d[]'],
			['/Arm/Angle', 'double'],
		] as const
	).map(([name, type]): [string, Entry] => [
		name,
		{ name, type, kind: getEntryKind(type), samples: createSamples(getEntryKind(type)), metadata: {} },
	]),
);
const entryOf = (name: string) => entries.get(name);

function split(children: LayoutInput[]): LayoutInput {
	return { kind: 'split', direction: 'row', children };
}

test('layouts are created with new IDs, bindings, roles, and options', () => {
	const layout = createInputLayout(
		split([
			{
				kind: 'pane',
				size: 0.7,
				widget: {
					type: 'field',
					options: { orientation: 'red-left' },
					bindings: [
						{ entry: '/Drive/Pose' },
						{ entry: '/Drive/Setpoint', role: 'point' },
						{ entry: '/Vision/Tags', connectedFrom: [0] },
					],
				},
			},
			{ kind: 'pane', widget: { type: 'console' } },
		]),
		entryOf,
	);

	const [field, console] = panes(layout);
	const [pose, setpoint, tags] = widgetBindings(field?.widget);
	expect(field?.size).toBe(0.7);
	expect(field?.widget?.config).toMatchObject({ options: { orientation: 'red-left' } });
	expect(setpoint?.role).toBe('point');
	expect(tags?.sources).toEqual([pose?.id]);
	// Widgets left without bindings start like ones the user adds
	expect(widgetBindings(console?.widget).map((binding) => binding.name)).toEqual(['/console', '/messages']);
	expect(new Set([layout.id, field?.id, console?.id, pose?.id, setpoint?.id, tags?.id]).size).toBe(6);
});

test('layouts with too many panes side by side are rejected', () => {
	const pane: LayoutInput = { kind: 'pane' };
	expect(() => createInputLayout(split([pane, pane, pane, pane, pane]), entryOf)).toThrow('At most 4 panes');
	// Nested splits in the same direction count together
	expect(() => createInputLayout(split([pane, split([pane, pane]), split([pane, pane])]), entryOf)).toThrow(
		'At most 4 panes',
	);
	expect(() => createInputLayout(split([pane, pane, pane, pane]), entryOf)).not.toThrow();
});

test('an agent cannot create a widget with more than 30 bindings', () => {
	const bindings = Array.from({ length: 31 }, () => ({ entry: '/Arm/Angle' }));
	expect(() => createInputLayout({ kind: 'pane', widget: { type: 'graph', bindings } }, entryOf)).toThrow(
		'up to 30 entries',
	);
});

test("bindings the user couldn't make are rejected", () => {
	const graph = getWidgetType('graph')!;
	const field = getWidgetType('field')!;
	expect(() => checkBinding(graph, '/Drive/Pose', undefined, entryOf)).toThrow("can't show `/Drive/Pose`");
	expect(() => checkBinding(field, '/Drive/Pose', 'path', entryOf)).toThrow('can be `robot`, `ghost`, `point`');
	expect(() => checkBinding(field, '/Drive/Pose', 'left', entryOf)).toThrow("isn't a role of Field widgets");
	expect(() => checkBinding(getWidgetType('notepad')!, '/Arm/Angle', undefined, entryOf)).toThrow("don't show entries");
	// Entries missing from the source might fit once they're loaded
	expect(() => checkBinding(field, '/Missing/Path', 'path', entryOf)).not.toThrow();
	expect(() =>
		createInputLayout(
			{
				kind: 'pane',
				widget: { type: 'field', bindings: [{ entry: '/Vision/Tags' }, { entry: '/Drive/Pose', connectedFrom: [0] }] },
			},
			entryOf,
		),
	).toThrow("can't be connected from `/Vision/Tags`");
});

function bindingProblems(layout: PaneNode, sourceOpen = true): (string[] | undefined)[] {
	const described = describeLayout(layout, entryOf, sourceOpen);
	return described.kind === 'pane' && described.widget && 'bindings' in described.widget
		? (described.widget.bindings ?? []).map((binding) => binding.problems)
		: [];
}

test("dashboards point out bindings that won't show what was meant", () => {
	const layout: PaneNode = {
		kind: 'pane',
		id: 'pane',
		widget: {
			type: 'field',
			config: {
				bindings: [
					{ id: 'missing', name: '/Missing/Pose' },
					{ id: 'unaccepted', name: '/Arm/Angle' },
					{ id: 'misfit', name: '/Drive/Pose', role: 'path' },
					{ id: 'fine', name: '/Drive/Setpoint' },
				],
			},
		},
	};

	expect(bindingProblems(layout)).toEqual([
		["The entry isn't in the active source."],
		["Field widgets can't show double entries."],
		["`path` doesn't fit struct:Pose2d entries, so it's shown as `robot`."],
		undefined,
	]);
	// Without a source, every entry would be missing
	expect(bindingProblems(layout, false)[0]).toBeUndefined();
});
