import { type LoroDoc, LoroMap, type LoroTree, type LoroTreeNode, UndoManager, type Value } from 'loro-crdt';
import { setEntries, writeList } from '@/lib/loro';
import { createPersistedDoc, removeStorage } from '@/lib/persisted-store';
import { createPane, type PaneNode, paneNodeSchema, type Widget } from '@/panes/layout';

/** The parts of a dashboard stored in its Loro document */
export type DashboardContents = {
	/** Set when the user renames the dashboard, otherwise a name is suggested from its contents with `dashboardName()` */
	name?: string | undefined;
	layout: PaneNode;
};

/**
 * Layouts are stored as a tree whose nodes hold a pane or split's fields, besides a split's `first` and `second` children.
 * Panes keep their tree node when a split moves them, so edits made to a pane while another peer splits it aren't lost.
 * A pane's widget is a map whose `bindings` are a list of maps, so bindings edited by several peers at once are all kept.
 */
function getLayoutTree(doc: LoroDoc): LoroTree {
	return doc.getTree('layout');
}

function getInfo(doc: LoroDoc): LoroMap {
	return doc.getMap('dashboard');
}

const layoutSchema = paneNodeSchema.catch(() => createPane());

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A node's fields, with its widget's `bindings` put back in its config */
function readData(node: LoroTreeNode): Record<string, unknown> {
	const data: unknown = node.data.toJSON();
	if (!isRecord(data)) {
		return {};
	}
	const widget = data['widget'];
	if (isRecord(widget) && Array.isArray(widget['bindings'])) {
		const { bindings, config, ...rest } = widget;
		data['widget'] = { ...rest, config: { ...(isRecord(config) ? config : {}), bindings } };
	}
	return data;
}

/** Puts nodes side by side as one node, nesting the extra ones in splits like `split`, with IDs every peer agrees on */
function nest(nodes: readonly Record<string, unknown>[], split: Record<string, unknown>): Record<string, unknown> {
	const [first, ...rest] = nodes;
	if (!first || rest.length === 0) {
		return first ?? {};
	}

	const id = `${String(split['id'])}+`;
	return { ...split, id, ratio: 0.5, first, second: nest(rest, { ...split, id }) };
}

/**
 * Peers editing at once can leave splits without exactly two children, ex. when two peers split the same pane.
 * Every peer reads them the same way: a split with one child is replaced by it, extra children are nested in splits, and
 * empty splits are left out.
 */
function readNode(node: LoroTreeNode): Record<string, unknown> | undefined {
	const data = readData(node);
	if (data['kind'] !== 'split') {
		return data;
	}

	const children = (node.children() ?? []).flatMap<Record<string, unknown>>((child) => readNode(child) ?? []);
	const [first, ...rest] = children;
	if (!first) {
		return undefined;
	}
	return rest.length === 0 ? first : { ...data, first, second: nest(rest, data) };
}

/** An empty document has an empty layout with a new pane ID each time, so `writeDashboardDoc()` a layout to new documents */
export function readDashboardDoc(doc: LoroDoc): DashboardContents {
	const name = getInfo(doc).get('name');
	// Peers that replaced the root at once leave several roots
	const roots = getLayoutTree(doc)
		.roots()
		.flatMap<Record<string, unknown>>((root) => readNode(root) ?? []);
	const [first] = roots;
	return {
		name: typeof name === 'string' ? name : undefined,
		layout: layoutSchema.parse(
			first && nest(roots, { kind: 'split', id: `${String(first['id'])}:root`, direction: 'row' }),
		),
	};
}

function writeWidget(data: LoroMap, widget: Widget | undefined): void {
	const existing = data.get('widget');
	// Deleting a missing widget would still be a change, which could win over a widget another peer adds at the same time
	if (widget === undefined) {
		if (existing !== undefined) {
			data.delete('widget');
		}
		return;
	}

	// Older documents store the widget as one value
	if (existing !== undefined && !(existing instanceof LoroMap)) {
		data.delete('widget');
	}
	const map = data.ensureMergeableMap('widget');
	const { bindings, ...config } = isRecord(widget.config) ? widget.config : { config: widget.config };
	setEntries(map, { type: widget.type, config }, 'bindings');
	if (Array.isArray(bindings)) {
		writeList(
			map.ensureMergeableMovableList('bindings'),
			bindings.filter((binding) => isRecord(binding)),
		);
	} else if (map.get('bindings') !== undefined) {
		map.delete('bindings');
	}
}

function writeNode(
	tree: LoroTree,
	existing: ReadonlyMap<unknown, LoroTreeNode>,
	written: Set<string>,
	node: PaneNode,
	parent: LoroTreeNode | undefined,
	index: number,
): void {
	written.add(node.id);
	let treeNode = existing.get(node.id);
	if (!treeNode) {
		treeNode = tree.createNode(parent?.id, index);
	} else if (treeNode.parent()?.id !== parent?.id || treeNode.index() !== index) {
		treeNode.move(parent, index);
	}

	if (node.kind === 'pane') {
		const { widget, ...pane } = node;
		setEntries(treeNode.data, pane, 'widget');
		writeWidget(treeNode.data, widget);
	} else {
		const { first, second, ...split } = node;
		setEntries(treeNode.data, split);
		writeNode(tree, existing, written, first, treeNode, 0);
		writeNode(tree, existing, written, second, treeNode, 1);
	}
}

/** Change a document to match `contents`, as moves and edits of the nodes it already has. Doesn't commit. */
export function writeDashboardDoc(doc: LoroDoc, { name, layout }: DashboardContents): void {
	setEntries(getInfo(doc), { name });

	const tree = getLayoutTree(doc);
	const existing = new Map(tree.getNodes().map((node) => [node.data.get('id'), node]));
	const written = new Set<string>();
	writeNode(tree, existing, written, layout, undefined, 0);

	// Deleting a node deletes its children, which may have been deleted already
	for (const node of tree.getNodes()) {
		if (tree.isNodeDeleted(node.id)) {
			continue;
		}

		const id = node.data.get('id');
		if (typeof id !== 'string' || !written.has(id)) {
			tree.delete(node.id);
		}
	}
}

export type DashboardDoc = {
	readonly doc: LoroDoc;
	/**
	 * Undo or redo this window's last change to the dashboard, changes made in other windows are left alone.
	 * Returns the pane that was focused before the change, or `false` if there's nothing to undo or redo.
	 */
	travel(direction: 'undo' | 'redo'): { focusedPaneId: string | undefined } | false;
};

const historyLimit = 100;

function storageKey(id: string): string {
	return `dashboard:${id}`;
}

/**
 * Load a dashboard's document, which is saved to localStorage and follows changes made in other windows.
 * A dashboard that was never saved gets the `initial` contents, which aren't an undo step. Its undo history lasts until
 * the window closes. Each undo step saves the pane from `getFocusedPaneId()` when the change is committed.
 */
export function loadDashboardDoc(
	id: string,
	getFocusedPaneId: () => string | undefined,
	initial?: DashboardContents,
): DashboardDoc {
	const doc = createPersistedDoc(storageKey(id));
	if (getLayoutTree(doc).roots().length === 0) {
		writeDashboardDoc(doc, initial ?? { layout: createPane() });
		doc.commit();
	}

	let poppedFocus: Value | undefined;
	const undoManager = new UndoManager(doc, {
		// Every change is its own step
		mergeInterval: 0,
		maxUndoSteps: historyLimit,
		onPush: () => ({ value: getFocusedPaneId() ?? null, cursors: [] }),
		// Undoing calls this before pushing the redo step, which saves the focus from before undoing
		onPop: (_isUndo, { value }) => {
			poppedFocus = value;
		},
	});

	return {
		doc,
		travel: (direction) =>
			undoManager[direction]() && { focusedPaneId: typeof poppedFocus === 'string' ? poppedFocus : undefined },
	};
}

/** Delete a dashboard's saved document */
export function deleteDashboardDoc(id: string): void {
	removeStorage(storageKey(id));
}
