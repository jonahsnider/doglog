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

/**
 * The rows to show, in order. Children of expanded groups are shown.
 * With a search query, only entries whose names contain it (ignoring case) and their parent groups are shown, all expanded.
 */
export function visibleKeyRows(tree: readonly KeyNode[], expanded: ReadonlySet<string>, query: string): KeyRow[] {
	const search = query.trim().toLowerCase();
	const rows: KeyRow[] = [];

	const addRows = (nodes: readonly KeyNode[], depth: number) => {
		for (const node of nodes) {
			if (search === '') {
				const isExpanded = expanded.has(node.path);
				rows.push({ node, depth, expanded: isExpanded });
				if (isExpanded) {
					addRows(node.children, depth + 1);
				}
				continue;
			}

			const index = rows.push({ node, depth, expanded: node.children.length > 0 }) - 1;
			addRows(node.children, depth + 1);
			const matches = node.entry?.name.toLowerCase().includes(search) ?? false;
			if (!matches && rows.length === index + 1) {
				// Nothing in this group matches
				rows.pop();
			}
		}
	};

	addRows(tree, 0);
	return rows;
}
