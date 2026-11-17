import { type TreeRow, visibleTreeRows } from '@ui-sdk/core/tree';
import type { Entry } from '@/data/data-store';
import { matchRanges, searchEntries } from '@/entry-search';
import type { EntryPlacements, EntrySection } from '@/entry-sections';

/** An entry or group in the entry browser tree, in the tree's item data shape. A node can be both, ex. `/Arm` and `/Arm/Angle` are both entries. */
export type EntryTreeNode = {
	/** Unique full path, ex. `/Arm/Angle` */
	readonly value: string;
	/** Last path segment, ex. `Angle`, or the full path for the top of a pinned or hidden entry or group */
	readonly label: string;
	entry?: Entry;
	/** Only set on the Pinned section's header */
	section?: 'pinned';
	/** Only set on groups, the tree treats any item with children as a branch */
	children?: EntryTreeNode[];
};

export type EntryTreeRow = TreeRow & { readonly item: EntryTreeNode; readonly section: EntrySection };

/** What the entry browser shows for the current expanded groups and search query */
export type EntryTreeView = {
	/** The hierarchy the tree navigates, only matches and their parent groups while searching */
	readonly items: EntryTreeNode[];
	/** Expanded groups, every group while searching */
	readonly expanded: string[];
	/** The rows to show, in order */
	readonly rows: EntryTreeRow[];
	/** Ranges of each node's label that matched, keyed by path, as `[start, end, start, end, ...]`. Only set while searching. */
	readonly highlights?: ReadonlyMap<string, readonly number[]>;
};

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function sortNodes(nodes: EntryTreeNode[]): void {
	nodes.sort((a, b) => collator.compare(a.label, b.label));
	for (const node of nodes) {
		if (node.children) {
			sortNodes(node.children);
		}
	}
}

/** Group entries into a tree by the `/`-separated segments of their names */
export function buildEntryTree(entries: readonly Entry[]): EntryTreeNode[] {
	const root: EntryTreeNode[] = [];
	const nodes = new Map<string, EntryTreeNode>();

	for (const entry of entries) {
		let siblings = root;
		let node: EntryTreeNode | undefined;
		let path = '';
		// Names start with `/`, skip the empty segment before it
		for (const segment of entry.name.split('/').slice(1)) {
			if (node) {
				siblings = node.children ??= [];
			}
			path += `/${segment}`;
			node = nodes.get(path);
			if (!node) {
				node = { value: path, label: segment };
				nodes.set(path, node);
				siblings.push(node);
			}
		}
		if (node) {
			node.entry = entry;
		}
	}

	sortNodes(root);
	return root;
}

/**
 * Move pinned and hidden entries and groups out of the tree. Pinned ones are put in a Pinned section before the rest of the tree,
 * which is left out when nothing is pinned unless `showEmptyPinned` is set, ex. so entries can be dragged into it.
 */
export function sectionEntryTree(
	tree: readonly EntryTreeNode[],
	placements: EntryPlacements,
	showEmptyPinned: boolean,
): { items: EntryTreeNode[]; hidden: EntryTreeNode[] } {
	const sections: Record<'pinned' | 'hidden', EntryTreeNode[]> = { pinned: [], hidden: [] };
	const place = (nodes: readonly EntryTreeNode[]): EntryTreeNode[] =>
		nodes.flatMap((node) => {
			const { children: _children, ...leaf } = node;
			const children = node.children && place(node.children);
			let placed: EntryTreeNode = leaf;
			if (children && children.length > 0) {
				placed = { ...leaf, children };
			} else if (!leaf.entry) {
				// Every entry in the group was moved out
				return [];
			}
			const section = placements[node.value];
			if (section) {
				sections[section].push({ ...placed, label: node.value });
				return [];
			}
			return [placed];
		});

	const main = place(tree);
	const sorted = (nodes: EntryTreeNode[]) => nodes.toSorted((a, b) => collator.compare(a.value, b.value));
	const pinned = sorted(sections.pinned);
	return {
		items:
			pinned.length > 0 || showEmptyPinned
				? [{ value: 'pinned', label: 'Pinned', section: 'pinned', children: pinned }, ...main]
				: main,
		hidden: sorted(sections.hidden),
	};
}

/**
 * The hierarchy and rows to show. Children of expanded groups are shown.
 * With a search query, only entries whose names or struct types fuzzy match it and their parent groups are shown, all expanded.
 */
export function entryTreeView(
	tree: EntryTreeNode[],
	expanded: string[],
	query: string,
	section: EntrySection = 'main',
): EntryTreeView {
	const search = searchTree(tree, query);
	if (!search) {
		return { items: tree, expanded, rows: sectionRows(visibleTreeRows(tree, expanded), section) };
	}

	const groups: string[] = [];
	const highlights = new Map<string, number[]>();
	const filter = (nodes: readonly EntryTreeNode[]): EntryTreeNode[] =>
		nodes.flatMap((node) => {
			const children = node.children && filter(node.children);
			let kept: EntryTreeNode;
			if (children && children.length > 0) {
				groups.push(node.value);
				kept = { ...node, children };
			} else if (node.entry && search.matches.has(node.entry.name)) {
				// Groups without matching children are shown as plain entries
				const { children: _children, ...leaf } = node;
				kept = leaf;
			} else {
				return [];
			}
			const ranges = labelRanges(kept, search.positions);
			if (ranges) {
				highlights.set(kept.value, ranges);
			}
			return [kept];
		});

	const items = filter(tree);
	return { items, expanded: groups, rows: sectionRows(visibleTreeRows(items, groups), section), highlights };
}

/** Which section each row is in, rows after the Pinned section's header are pinned until the next top level row */
function sectionRows(
	rows: readonly (TreeRow & { readonly item: EntryTreeNode })[],
	treeSection: EntrySection,
): EntryTreeRow[] {
	let section = treeSection;
	return rows.map((row) => {
		if (row.level === 1) {
			section = row.item.section ?? treeSection;
		}
		return { ...row, section };
	});
}

/** Matched ranges of a node's label, which is the end of its path */
function labelRanges(node: EntryTreeNode, positions: ReadonlyMap<string, number[]>): number[] | undefined {
	const start = node.value.length - node.label.length;
	const matched: number[] = [];
	// Labels can span several segments, ex. a pinned entry's full path
	let end = start;
	while (end < node.value.length) {
		end = node.value.indexOf('/', end + 1);
		if (end === -1) {
			end = node.value.length;
		}
		for (const position of positions.get(node.value.slice(0, end)) ?? []) {
			matched.push(position - start);
		}
	}
	return matched.length > 0 ? matchRanges(matched) : undefined;
}

/** Names of the entries matching the query and the matched positions in their names, keyed by the path of the segment they're in, or `undefined` when the query has nothing to search for */
function searchTree(
	tree: readonly EntryTreeNode[],
	query: string,
): { matches: Set<string>; positions: Map<string, number[]> } | undefined {
	const entries: Entry[] = [];
	const collect = (nodes: readonly EntryTreeNode[]) => {
		for (const node of nodes) {
			if (node.entry) {
				entries.push(node.entry);
			}
			if (node.children) {
				collect(node.children);
			}
		}
	};
	collect(tree);

	const results = searchEntries(entries, query);
	if (!results) {
		return undefined;
	}

	// Groups combine the matches of every entry in them
	const positions = new Map<string, number[]>();
	for (const result of results) {
		const { name } = result.obj;
		for (const index of result[0]!.indexes) {
			const end = name.indexOf('/', index);
			const path = end === -1 ? name : name.slice(0, end);
			let matched = positions.get(path);
			if (!matched) {
				matched = [];
				positions.set(path, matched);
			}
			matched.push(index);
		}
	}

	return { matches: new Set(results.map((result) => result.obj.name)), positions };
}
