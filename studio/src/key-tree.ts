import uFuzzy from '@leeoniya/ufuzzy';
import type { Entry } from '@/data/data-store';

/** An entry or group in the key browser tree. A node can be both, ex. `/Arm` and `/Arm/Angle` are both entries. */
export type KeyNode = {
	/** Unique full path, ex. `/Arm/Angle` */
	readonly path: string;
	/** Last path segment, ex. `Angle` */
	readonly label: string;
	entry?: Entry;
	readonly children: KeyNode[];
};

export type KeyRow = {
	readonly node: KeyNode;
	readonly depth: number;
	readonly expanded: boolean;
	/** Ranges of the label matching the search query, as `[start, end, start, end, ...]` */
	readonly highlights?: readonly number[];
};

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function sortNodes(nodes: KeyNode[]): void {
	nodes.sort((a, b) => collator.compare(a.label, b.label));
	for (const node of nodes) {
		sortNodes(node.children);
	}
}

/** Group entries into a tree by the `/`-separated segments of their names */
export function buildKeyTree(entries: readonly Entry[]): KeyNode[] {
	const root: KeyNode = { path: '', label: '', children: [] };
	const nodes = new Map<string, KeyNode>();

	for (const entry of entries) {
		let parent = root;
		let path = '';
		// Names start with `/`, skip the empty segment before it
		for (const segment of entry.name.split('/').slice(1)) {
			path += `/${segment}`;
			let node = nodes.get(path);
			if (!node) {
				node = { path, label: segment, children: [] };
				nodes.set(path, node);
				parent.children.push(node);
			}
			parent = node;
		}
		parent.entry = entry;
	}

	sortNodes(root.children);
	return root.children;
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
			collect(node.children);
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

/**
 * The rows to show, in order. Children of expanded groups are shown.
 * With a search query, only entries whose names fuzzy match it and their parent groups are shown, all expanded.
 */
export function visibleKeyRows(tree: readonly KeyNode[], expanded: ReadonlySet<string>, query: string): KeyRow[] {
	const matches = searchNames(tree, query);
	const rows: KeyRow[] = [];

	const addRows = (nodes: readonly KeyNode[], depth: number) => {
		for (const node of nodes) {
			if (!matches) {
				const isExpanded = expanded.has(node.path);
				rows.push({ node, depth, expanded: isExpanded });
				if (isExpanded) {
					addRows(node.children, depth + 1);
				}
				continue;
			}

			const highlights = node.entry && matches.get(node.entry.name);
			const index =
				rows.push({ node, depth, expanded: node.children.length > 0, ...(highlights && { highlights }) }) - 1;
			addRows(node.children, depth + 1);
			if (!highlights && rows.length === index + 1) {
				// Nothing in this group matches
				rows.pop();
			}
		}
	};

	addRows(tree, 0);
	return rows;
}
