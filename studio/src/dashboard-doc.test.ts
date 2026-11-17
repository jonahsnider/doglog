import { LoroDoc, UndoManager } from 'loro-crdt';
import { expect, test } from 'vite-plus/test';
import { type DashboardContents, readDashboardDoc, writeDashboardDoc } from './dashboard-doc.ts';
import { closePane, createPane, firstPane, resizeSplit, setPaneWidget, splitPane } from './pane-layout.ts';

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
	edit(({ layout }) => ({ layout: resizeSplit(layout, layout.id, 0.3) }));
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
