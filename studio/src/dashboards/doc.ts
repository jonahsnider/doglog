import {
	type LoroDoc,
	LoroMap,
	type LoroText,
	type LoroTree,
	type LoroTreeNode,
	UndoManager,
	type Value,
} from 'loro-crdt';
import { setEntries, writeList } from '@/lib/loro';
import { createPersistedDoc, removeStorage, saveDoc } from '@/lib/persisted-store';
import { createPane, type PaneNode, paneNodeSchema, type Widget } from '@/panes/layout';

/** The parts of a dashboard stored in its Loro document */
export type DashboardContents = {
	/** Set when the user renames the dashboard, otherwise a name is suggested from its contents with `dashboardName()` */
	name?: string | undefined;
	layout: PaneNode;
};

/**
 * Layouts are stored as a tree whose nodes hold a pane or split's fields, besides a split's `children`.
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
	if (!(node.data.get('widget') instanceof LoroMap)) {
		delete data['widget'];
	} else if (isRecord(widget) && Array.isArray(widget['bindings'])) {
		const { bindings, config, ...rest } = widget;
		data['widget'] = { ...rest, config: { ...(isRecord(config) ? config : {}), bindings } };
	}
	return data;
}

/**
 * Peers editing at once can leave splits with one child or none, ex. when two peers close panes in the same split.
 * Every peer reads them the same way: `paneNodeSchema` replaces a split with one child by it, and empty splits are left out.
 */
function readNode(node: LoroTreeNode): Record<string, unknown> | undefined {
	const data = readData(node);
	if (data['kind'] !== 'split') {
		return data;
	}

	const children = (node.children() ?? []).flatMap<Record<string, unknown>>((child) => readNode(child) ?? []);
	return children.length === 0 ? undefined : { ...data, children };
}

/** An empty document has an empty layout with a new pane ID each time, so `writeDashboardDoc()` a layout to new documents */
export function readDashboardDoc(doc: LoroDoc): DashboardContents {
	const name = getInfo(doc).get('name');
	// Peers that replaced the root at once leave several roots, which are put side by side
	const roots = getLayoutTree(doc)
		.roots()
		.flatMap<Record<string, unknown>>((root) => readNode(root) ?? []);
	const [first] = roots;
	return {
		name: typeof name === 'string' ? name : undefined,
		layout: layoutSchema.parse(
			first && { kind: 'split', id: `${String(first['id'])}:root`, direction: 'row', children: roots },
		),
	};
}

function writeWidget(data: LoroMap, widget: Widget | undefined): void {
	// Deleting a missing widget would still be a change, which could win over a widget another peer adds at the same time
	if (widget === undefined) {
		if (data.get('widget') !== undefined) {
			data.delete('widget');
		}
		return;
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
		const { children, ...split } = node;
		setEntries(treeNode.data, split);
		children.forEach((child, childIndex) => writeNode(tree, existing, written, child, treeNode, childIndex));
	}
}

/** Change a document to match `contents`, as moves and edits of the nodes it already has. Doesn't commit. */
export function writeDashboardDoc(doc: LoroDoc, { name, layout }: DashboardContents): void {
	setEntries(getInfo(doc), { name });

	const tree = getLayoutTree(doc);
	const existing = new Map(tree.getNodes().map((node) => [node.data.get('id'), node]));
	const written = new Set<string>();
	writeNode(tree, existing, written, layout, undefined, 0);

	for (const root of tree.roots()) {
		deleteUnwritten(tree, written, root);
	}
}

/**
 * Delete the nodes that weren't written, children before their parents.
 *
 * Deleting a parent also deletes its children, but loro-crdt 1.19.0 and 1.19.1 (not 1.18) have a bug where undoing that
 * restores the contents of the children's mergeable lists and text twice. Closing a pane and undoing it would duplicate
 * the bindings of the pane next to it, as real edits that get saved and synced. Undo restores nodes correctly when each
 * one was deleted on its own. This deletes the same nodes as deleting parents alone, since `writeNode()` already moved
 * the nodes that are kept out of them.
 */
function deleteUnwritten(tree: LoroTree, written: ReadonlySet<string>, node: LoroTreeNode): void {
	for (const child of node.children() ?? []) {
		deleteUnwritten(tree, written, child);
	}

	const id = node.data.get('id');
	if (typeof id !== 'string' || !written.has(id)) {
		tree.delete(node.id);
	}
}

/** Whether a dashboard is shared with everyone connected to a robot, kept apart from its contents */
export type DashboardSharing = {
	/** The robot host it's shared on, see `sharingScope()`. `undefined` for a dashboard only on this device. */
	scope?: string | undefined;
	/** When someone deleted it for everyone, in milliseconds since the epoch */
	deletedAt?: number | undefined;
};

function getSharing(doc: LoroDoc): LoroMap {
	return doc.getMap('sharing');
}

export function readSharing(doc: LoroDoc): DashboardSharing {
	const sharing = getSharing(doc);
	const scope = sharing.get('scope');
	const deletedAt = sharing.get('deletedAt');
	return {
		scope: typeof scope === 'string' ? scope : undefined,
		deletedAt: typeof deletedAt === 'number' ? deletedAt : undefined,
	};
}

/** Change how a dashboard is shared. Doesn't commit. */
export function writeSharing(doc: LoroDoc, sharing: DashboardSharing): void {
	setEntries(getSharing(doc), sharing);
}

const notesOrigin = 'notepad';

/** Notes belong to the dashboard, not to a pane or its layout. */
export function getDashboardNotes(doc: LoroDoc): LoroText {
	return doc.getText('notes');
}

export function setDashboardNotes(doc: LoroDoc, notes: string): void {
	getDashboardNotes(doc).update(notes);
	doc.commit({ origin: notesOrigin });
}

export function copyDashboardNotes(from: LoroDoc, to: LoroDoc): void {
	const notes = getDashboardNotes(from).toString();
	if (notes !== '') {
		setDashboardNotes(to, notes);
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
	// Typing in the notepad uses the text field's undo, not the dashboard's layout undo.
	undoManager.addExcludeOriginPrefix(notesOrigin);

	return {
		doc,
		travel: (direction) =>
			undoManager[direction]() && { focusedPaneId: typeof poppedFocus === 'string' ? poppedFocus : undefined },
	};
}

/** Save a document that received changes from other devices, since only local changes are saved automatically */
export function saveDashboardDoc(id: string, doc: LoroDoc): void {
	saveDoc(storageKey(id), doc);
}

export function deleteDashboardDoc(id: string): void {
	removeStorage(storageKey(id));
}
