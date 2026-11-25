import { LoroDoc, UndoManager } from 'loro-crdt';
import { expect, test } from 'vite-plus/test';
import {
	type DashboardContents,
	getDashboardNotes,
	loadDashboardDoc,
	readDashboardDoc,
	setDashboardNotes,
	writeDashboardDoc,
} from './doc.ts';
import { closePane, createPane, firstPane, paneIds, resizeSplit, setPaneWidget, splitPane } from '../panes/layout.ts';

const graph = { type: 'line-graph', config: { bindings: [{ id: 'arm', name: '/Arm/Angle' }] } };

function write(doc: LoroDoc, contents: DashboardContents): void {
	writeDashboardDoc(doc, contents);
	doc.commit();
}

test('dashboards read back the same after each edit', () => {
	const doc = new LoroDoc();
	const pane = createPane();
	const steps: DashboardContents[] = [{ layout: pane }];
	const edit = (update: (contents: DashboardContents) => DashboardContents) => {
		steps.push(update(steps.at(-1)!));
	};

	edit(({ layout }) => ({ layout: setPaneWidget(layout, pane.id, graph) }));
	edit(({ layout }) => ({ layout: splitPane(layout, pane.id, 'row') }));
	edit(({ layout }) => ({ layout: splitPane(layout, pane.id, 'column') }));
	edit(({ layout }) => ({ layout: resizeSplit(layout, layout.id, [0.3, 0.7]) }));
	edit((contents) => ({ ...contents, name: 'Arm tuning' }));
	edit((contents) => ({ ...contents, layout: closePane(contents.layout, pane.id) }));
	edit(({ layout }) => ({ layout: setPaneWidget(layout, firstPane(layout).id, undefined) }));

	for (const contents of steps) {
		write(doc, contents);
		expect(readDashboardDoc(doc)).toEqual({ name: undefined, ...contents });
	}

	const copy = new LoroDoc();
	copy.import(doc.export({ mode: 'snapshot' }));
	expect(readDashboardDoc(copy)).toEqual(readDashboardDoc(doc));
});

test('undo restores the layout from before each edit', () => {
	const doc = new LoroDoc();
	const pane = { ...createPane(), widget: graph };
	const split = splitPane(pane, pane.id, 'row');
	write(doc, { layout: pane });
	const undoManager = new UndoManager(doc, { mergeInterval: 0 });

	write(doc, { layout: split });
	write(doc, { layout: closePane(split, pane.id) });

	undoManager.undo();
	expect(readDashboardDoc(doc).layout).toEqual(split);
	undoManager.undo();
	expect(readDashboardDoc(doc).layout).toEqual(pane);
	undoManager.redo();
	expect(readDashboardDoc(doc).layout).toEqual(split);
});

test("a pane's widget changed while another peer splits it is kept", () => {
	const doc = new LoroDoc();
	const pane = createPane();
	write(doc, { layout: pane });
	const other = doc.fork();

	const split = splitPane(pane, pane.id, 'row');
	write(doc, { layout: split });
	write(other, { layout: setPaneWidget(pane, pane.id, graph) });
	doc.import(other.export({ mode: 'update' }));

	expect(readDashboardDoc(doc).layout).toEqual(setPaneWidget(split, pane.id, graph));
});

test('bindings edited by two peers at once are all kept', () => {
	const doc = new LoroDoc();
	const pane = { ...createPane(), widget: graph };
	write(doc, { layout: pane });
	const other = doc.fork();

	const added = { ...graph, config: { bindings: [...graph.config.bindings, { id: 'wrist', name: '/Wrist/Angle' }] } };
	const recolored = { ...graph, config: { bindings: [{ id: 'arm', name: '/Arm/Angle', color: 2 }] } };
	write(doc, { layout: setPaneWidget(pane, pane.id, added) });
	write(other, { layout: setPaneWidget(pane, pane.id, recolored) });
	doc.import(other.export({ mode: 'update' }));

	expect(readDashboardDoc(doc).layout).toEqual(
		setPaneWidget(pane, pane.id, {
			...graph,
			config: {
				bindings: [
					{ id: 'arm', name: '/Arm/Angle', color: 2 },
					{ id: 'wrist', name: '/Wrist/Angle' },
				],
			},
		}),
	);
});

test('peers splitting the same pane at once end up with the same valid layout', () => {
	const doc = new LoroDoc();
	const pane = createPane();
	write(doc, { layout: pane });
	const other = doc.fork();

	write(doc, { layout: splitPane(pane, pane.id, 'row') });
	write(other, { layout: splitPane(pane, pane.id, 'column') });
	doc.import(other.export({ mode: 'update' }));
	other.import(doc.export({ mode: 'update' }));

	const { layout } = readDashboardDoc(doc);
	expect(readDashboardDoc(other).layout).toEqual(layout);
	// Every pane is kept: the original and each peer's new pane
	expect(paneIds(layout)).toHaveLength(3);
	expect(paneIds(layout)).toContain(pane.id);

	write(doc, { layout });
	expect(readDashboardDoc(doc).layout).toEqual(layout);
});

test('concurrent Notepad edits travel in dashboard updates and merge', () => {
	const doc = new LoroDoc();
	const pane = { ...createPane(), widget: { type: 'notepad', config: {} } };
	write(doc, { layout: pane });
	setDashboardNotes(doc, 'Arm kP: 0.2\nWrist kD: 0.05');
	const baseline = doc.oplogVersion();
	const peer = doc.fork();

	setDashboardNotes(doc, 'Arm kP: 0.7\nWrist kD: 0.05');
	setDashboardNotes(peer, 'Arm kP: 0.2\nWrist kD: 0.11');
	peer.import(doc.export({ mode: 'update', from: baseline }));
	doc.import(peer.export({ mode: 'update', from: baseline }));

	expect(getDashboardNotes(doc).toString()).toBe('Arm kP: 0.7\nWrist kD: 0.11');
	expect(getDashboardNotes(peer).toString()).toBe('Arm kP: 0.7\nWrist kD: 0.11');
	expect(readDashboardDoc(peer).layout).toEqual(pane);
});

test('closing and undoing a Notepad pane leaves the dashboard notes intact', () => {
	const pane = { ...createPane(), widget: { type: 'notepad', config: {} } };
	const dashboard = loadDashboardDoc('notepad-layout-undo', () => undefined, { layout: pane });
	const { doc } = dashboard;
	setDashboardNotes(doc, 'Try a lower kP');
	write(doc, { layout: setPaneWidget(pane, pane.id, undefined) });
	expect(getDashboardNotes(doc).toString()).toBe('Try a lower kP');
	expect(dashboard.travel('undo')).not.toBe(false);
	expect(readDashboardDoc(doc).layout).toEqual(pane);
	expect(dashboard.travel('undo')).toBe(false);
	expect(getDashboardNotes(doc).toString()).toBe('Try a lower kP');
});
