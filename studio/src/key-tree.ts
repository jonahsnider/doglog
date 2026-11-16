import uFuzzy from '@leeoniya/ufuzzy';
import { type TreeRow, visibleTreeRows } from '@ui-sdk/core/tree';
import type { Entry } from '@/data/data-store';

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
	/** Ranges of each matching entry's label, keyed by entry name, as `[start, end, start, end, ...]`. Only set while searching. */
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
 * With a search query, only entries whose names fuzzy match it and their parent groups are shown, all expanded.
 */
export function keyTreeView(tree: KeyNode[], expanded: string[], query: string): KeyTreeView {
	const highlights = searchNames(tree, query);
	if (!highlights) {
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
			if (!node.entry || !highlights.has(node.entry.name)) {
				return [];
			}
			// Groups without matching children are shown as plain entries
			const { children: _children, ...leaf } = node;
			return [leaf];
		});

	const items = filter(tree);
	return { items, expanded: groups, rows: visibleTreeRows(items, groups), highlights };
}

// Tolerates a single typo in each search term
// oxlint-disable-next-line typescript/no-unsafe-enum-assignment -- uFuzzy's const enum can't be used with verbatimModuleSyntax
const fuzzy = new uFuzzy({ intraMode: 1 });

/** Map each entry name matching the query to the ranges of its label that matched, or `undefined` when the query has nothing to search for */
function searchNames(tree: readonly KeyNode[], query: string): Map<string, number[]> | undefined {
	const names: string[] = [];
	const collect = (nodes: readonly KeyNode[]) => {
		for (const node of nodes) {
			if (node.entry) {
				names.push(node.entry.name);
			}
			if (node.children) {
				collect(node.children);
			}
		}
	};
	collect(tree);

	// oxlint-disable-next-line unicorn/no-array-callback-reference, unicorn/no-array-method-this-argument -- Not an array method
	const indexes = fuzzy.filter(names, query);
	if (!indexes) {
		return undefined;
	}
	const info = fuzzy.info(indexes, names, query);
	return new Map(info.idx.map((index, i) => [names[index]!, labelRanges(names[index]!, info.ranges[i]!)]));
}

/** Shift ranges of a full name to be relative to its last segment, dropping ranges in earlier segments */
function labelRanges(name: string, ranges: readonly number[]): number[] {
	const offset = name.lastIndexOf('/') + 1;
	const result: number[] = [];
	for (let i = 0; i < ranges.length; i += 2) {
		const end = ranges[i + 1]! - offset;
		if (end > 0) {
			result.push(Math.max(ranges[i]! - offset, 0), end);
		}
	}
	return result;
}
