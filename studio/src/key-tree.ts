import { type TreeRow, visibleTreeRows } from '@ui-sdk/core/tree';
import type { Entry } from '@/data/data-store';
import { matchRanges, searchEntries } from '@/entry-search';

/** An entry or group in the key browser tree, in the tree's item data shape. A node can be both, ex. `/Arm` and `/Arm/Angle` are both entries. */
export type KeyNode = {
	/** Unique full path, ex. `/Arm/Angle` */
	readonly value: string;
	/** Last path segment, ex. `Angle` */
	readonly label: string;
	entry?: Entry;
	/** Only set on groups, the tree treats any item with children as a branch */
	children?: KeyNode[];
};

export type KeyRow = TreeRow & { readonly item: KeyNode };

/** What the key browser shows for the current expanded groups and search query */
export type KeyTreeView = {
	/** The hierarchy the tree navigates, only matches and their parent groups while searching */
	readonly items: KeyNode[];
	/** Expanded groups, every group while searching */
	readonly expanded: string[];
	/** The rows to show, in order */
	readonly rows: KeyRow[];
	/** Ranges of each node's label that matched, keyed by path, as `[start, end, start, end, ...]`. Only set while searching. */
	readonly highlights?: ReadonlyMap<string, readonly number[]>;
};

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function sortNodes(nodes: KeyNode[]): void {
	nodes.sort((a, b) => collator.compare(a.label, b.label));
	for (const node of nodes) {
		if (node.children) {
			sortNodes(node.children);
		}
	}
}

/** Group entries into a tree by the `/`-separated segments of their names */
export function buildKeyTree(entries: readonly Entry[]): KeyNode[] {
	const root: KeyNode[] = [];
	const nodes = new Map<string, KeyNode>();

	for (const entry of entries) {
		let siblings = root;
		let node: KeyNode | undefined;
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
 * The hierarchy and rows to show. Children of expanded groups are shown.
 * With a search query, only entries whose names or struct types fuzzy match it and their parent groups are shown, all expanded.
 */
export function keyTreeView(tree: KeyNode[], expanded: string[], query: string): KeyTreeView {
	const search = searchTree(tree, query);
	if (!search) {
		return { items: tree, expanded, rows: visibleTreeRows(tree, expanded) };
	}

	const groups: string[] = [];
	const filter = (nodes: readonly KeyNode[]): KeyNode[] =>
		nodes.flatMap((node) => {
			const children = node.children && filter(node.children);
			if (children && children.length > 0) {
				groups.push(node.value);
				return [{ ...node, children }];
			}
			if (!node.entry || !search.matches.has(node.entry.name)) {
				return [];
			}
			// Groups without matching children are shown as plain entries
			const { children: _children, ...leaf } = node;
			return [leaf];
		});

	const items = filter(tree);
	return { items, expanded: groups, rows: visibleTreeRows(items, groups), highlights: search.highlights };
}

/** Names of the entries matching the query and the matched ranges of each node's label, or `undefined` when the query has nothing to search for */
function searchTree(
	tree: readonly KeyNode[],
	query: string,
): { matches: Set<string>; highlights: Map<string, number[]> } | undefined {
	const entries: Entry[] = [];
	const collect = (nodes: readonly KeyNode[]) => {
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

	// Matched positions in each segment's label, keyed by path. Groups combine the matches of every entry in them.
	const positions = new Map<string, number[]>();
	for (const result of results) {
		const { name } = result.obj;
		for (const index of result[0]!.indexes) {
			const end = name.indexOf('/', index);
			const path = end === -1 ? name : name.slice(0, end);
			const segmentStart = name.lastIndexOf('/', index) + 1;
			let matched = positions.get(path);
			if (!matched) {
				matched = [];
				positions.set(path, matched);
			}
			matched.push(index - segmentStart);
		}
	}

	return {
		matches: new Set(results.map((result) => result.obj.name)),
		highlights: new Map(Array.from(positions, ([path, matched]) => [path, matchRanges(matched)])),
	};
}
