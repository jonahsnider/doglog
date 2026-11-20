/// <reference types="node" />

import { Buffer } from 'node:buffer';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import { LoroDoc } from 'loro-crdt';
import { expect, test } from 'vite-plus/test';
import { restoreLayout } from '@/panes/layout-snapshot';
import {
	DashboardLinkTooLarge,
	dashboardSnapshot,
	decodeDashboardLink,
	encodeDashboardLink,
	snapshotKey,
} from './dashboard-link.ts';
import { type DashboardContents, readDashboardDoc, writeDashboardDoc } from './doc.ts';

function linkFromJson(json: string): string {
	return `v1.${deflateRawSync(json).toString('base64url')}`;
}

test('dashboard links use ID-free tuples and survive import into a fresh document', async () => {
	const original = {
		name: 'Réglage 🤖',
		layout: {
			kind: 'split',
			direction: 'row',
			id: 'split-id',
			children: [
				{
					kind: 'pane',
					id: 'first-pane',
					size: 0.7123456789012345,
					widget: {
						type: 'field',
						config: {
							options: { y: 'second', x: 'first' },
							future: { mode: 'portrait' },
							bindings: [
								{ id: 'first-binding', name: '/Drive/Pose' },
								{ id: 'second-binding', name: '/Drive/Pose', color: 0, future: ['alias'] },
								{ id: 'target', name: '/Vision/Tags', hidden: true, sources: ['second-binding'] },
							],
						},
					},
				},
				{
					kind: 'split',
					direction: 'column',
					id: 'column-id',
					size: 0.2876543210987655,
					children: [
						{ kind: 'pane', id: 'empty-pane', size: 0.3 },
						{ kind: 'pane', id: 'graph-pane', widget: { type: 'graph', config: { bindings: [] } } },
						{ kind: 'pane', id: 'console-pane', widget: { type: 'console', config: {} } },
					],
				},
			],
		},
	} satisfies DashboardContents;
	const hash = await encodeDashboardLink(original);
	expect(hash).toMatch(/^v1\.[A-Za-z0-9_-]+$/u);
	const expected = {
		name: 'Réglage 🤖',
		layout: {
			kind: 'split',
			direction: 'row',
			children: [
				{
					kind: 'pane',
					size: 0.7123456789012345,
					widget: {
						type: 'field',
						config: { options: { x: 'first', y: 'second' }, future: { mode: 'portrait' } },
						bindings: [
							{ name: '/Drive/Pose' },
							{ name: '/Drive/Pose', color: 0, future: ['alias'] },
							{ name: '/Vision/Tags', hidden: true, connectedFrom: [1] },
						],
					},
				},
				{
					kind: 'split',
					direction: 'column',
					size: 0.2876543210987655,
					children: [
						{ kind: 'pane', size: 0.3 },
						{ kind: 'pane', widget: { type: 'graph', config: {}, bindings: [] } },
						{ kind: 'pane', widget: { type: 'console', config: {} } },
					],
				},
			],
		},
	};
	expect(JSON.parse(inflateRawSync(Buffer.from(hash.slice(3), 'base64url')).toString('utf8'))).toEqual([
		[
			1,
			[
				[
					0,
					[
						'field',
						{ options: { x: 'first', y: 'second' }, future: { mode: 'portrait' } },
						[
							['/Drive/Pose'],
							['/Drive/Pose', { color: 0, future: ['alias'] }],
							['/Vision/Tags', { hidden: true, connectedFrom: [1] }],
						],
					],
					0.7123456789012345,
				],
				[
					2,
					[
						[0, null, 0.3],
						[0, ['graph', null, []]],
						[0, ['console']],
					],
					0.2876543210987655,
				],
			],
		],
		'Réglage 🤖',
	]);
	const snapshot = await decodeDashboardLink(hash);
	expect(snapshot).toEqual(expected);
	const doc = new LoroDoc();
	writeDashboardDoc(doc, { name: snapshot.name, layout: restoreLayout(snapshot.layout) });
	doc.commit();
	const imported = readDashboardDoc(doc);
	expect(imported.layout.id).not.toBe(original.layout.id);
	expect(snapshotKey(dashboardSnapshot(imported))).toBe(snapshotKey(dashboardSnapshot(original)));
	const reordered = { ...original, layout: { ...original.layout, children: original.layout.children.toReversed() } };
	expect(snapshotKey(dashboardSnapshot(reordered))).not.toBe(snapshotKey(snapshot));
});

test.each([
	{ name: undefined, wire: [[0]] },
	{ name: '', wire: [[0], ''] },
])('preserves a dashboard name of $name', async ({ name, wire }) => {
	const hash = await encodeDashboardLink({ name, layout: { kind: 'pane', id: 'pane' } });
	expect(JSON.parse(inflateRawSync(Buffer.from(hash.slice(3), 'base64url')).toString('utf8'))).toEqual(wire);
	expect((await decodeDashboardLink(hash)).name).toBe(name);
});

test('caps the inflated UTF-8 byte count even for a short URL', async () => {
	const hash = linkFromJson(JSON.stringify([[0], 'é'.repeat(65_536)]));
	await expect(decodeDashboardLink(hash)).rejects.toThrow(DashboardLinkTooLarge);
});

test('rejects unsupported versions before decompressing', async () => {
	const payload = linkFromJson('[[0]]').slice(3);
	await expect(decodeDashboardLink(`v2.${payload}`)).rejects.toThrow('Invalid dashboard link');
});

test.each([
	['corrupt deflate', 'v1.e30'],
	['oversized payload', `v1.${'A'.repeat(16 * 1024 + 1)}`],
	['deep config', linkFromJson(`[[0,["field",{"nested":${'['.repeat(40)}0${']'.repeat(40)}}]]]`)],
	['too few children', linkFromJson('[[1,[[0]]]]')],
	['unknown layout tag', linkFromJson('[[3,[[0],[0]]]]')],
	['extra tuple slots', linkFromJson('[[0,["console",null,[],"extra"]]]')],
	['non-tuple JSON', linkFromJson('{"layout":{"kind":"pane"}}')],
	['non-object config', linkFromJson('[[0,["field",[]]]]')],
	['binding name in metadata', linkFromJson('[[0,["field",null,[["/Pose",{"name":"/Other"}]]]]]')],
	['binding ID in metadata', linkFromJson('[[0,["field",null,[["/Pose",{"id":"abc"}]]]]]')],
	['out-of-bounds connection', linkFromJson('[[0,["field",null,[["/Pose",{"connectedFrom":[1]}]]]]]')],
])('rejects %s', async (_label, hash) => {
	await expect(decodeDashboardLink(hash)).rejects.toBeInstanceOf(Error);
});
