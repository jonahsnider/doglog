import { type LoroDoc, type LoroMap, type LoroTree, type LoroTreeNode, UndoManager, type Value } from 'loro-crdt';
import { createPersistedDoc, removeStorage } from '@/lib/persisted-store';
import { createPane, type PaneNode, paneNodeSchema } from '@/panes/layout';

/** The parts of a dashboard stored in its Loro document */
export type DashboardContents = {
	/** Set when the user renames the dashboard, otherwise a name is suggested from its contents with `dashboardName()` */
	name?: string | undefined;
	layout: PaneNode;
};

/**
 * Layouts are stored as a tree whose nodes hold a pane or split's fields, besides a split's `first` and `second` children.
 * Panes keep their tree node when a split moves them, so edits made to a pane while another peer splits it aren't lost.
 */
function getLayoutTree(doc: LoroDoc): LoroTree {
	return doc.getTree('layout');
}

function getInfo(doc: LoroDoc): LoroMap {
	return doc.getMap('dashboard');
}

const layoutSchema = paneNodeSchema.catch(() => createPane());

function readNode(node: LoroTreeNode): unknown {
	const [first, second] = node.children() ?? [];
	return { ...node.data.toJSON(), first: first && readNode(first), second: second && readNode(second) };
}

/** An empty document has an empty layout with a new pane ID each time, so `writeDashboardDoc()` a layout to new documents */
export function readDashboardDoc(doc: LoroDoc): DashboardContents {
	const name = getInfo(doc).get('name');
	const root = getLayoutTree(doc).roots()[0];
	return {
		name: typeof name === 'string' ? name : undefined,
		layout: layoutSchema.parse(root && readNode(root)),
	};
}

/** Set a map's entries to `values`, without making changes for values that are already set */
function setEntries(map: LoroMap, values: Record<string, unknown>): void {
	for (const [key] of map.entries()) {
		if (values[key] === undefined) {
			map.delete(key);
		}
	}
	for (const [key, value] of Object.entries(values)) {
		if (value !== undefined) {
			map.set(key, value);
		}
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
		setEntries(treeNode.data, node);
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
