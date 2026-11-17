import type { PaneNode, Split } from '@/panes/layout';

// How a split's children share its space. Children resized by the user have a `size`, the others share what's left evenly.

function withSize(node: PaneNode, size: number | undefined): PaneNode {
	return { ...node, size };
}

/** Each child's share of a split, in order. Children without a size share what the others leave evenly. */
export function childSizes(split: Split): number[] {
	const sized = split.children.flatMap((child) => child.size ?? []);
	const total = sized.reduce((sum, size) => sum + size, 0);
	const unsized = split.children.length - sized.length;
	// Peers resizing at once can leave the sized children with all the space, so the others keep a little
	const shared = unsized === 0 ? 0 : Math.max(1 - total, 0.1 * unsized) / unsized;
	const sizes = split.children.map((child) => child.size ?? shared);
	const sum = total + shared * unsized;
	return sizes.map((size) => size / sum);
}

function sizesEqual(sizes: readonly number[]): boolean {
	return sizes.every((size) => Math.abs(size - (sizes[0] ?? 0)) < 1e-6);
}

/**
 * Puts a layout back in shape after an edit: a split left with one child is replaced by it, and a split inside one in
 * the same direction has its children moved up, keeping their sizes.
 */
export function normalize(node: PaneNode): PaneNode {
	if (node.kind === 'pane') {
		return node;
	}

	const children = node.children.map((child) => normalize(child));
	const [only] = children;
	if (only && children.length === 1) {
		return { ...only, size: node.size };
	}

	if (!children.some((child) => child.kind === 'split' && child.direction === node.direction)) {
		return { ...node, children };
	}

	const outer = childSizes({ ...node, children });
	const flattened = children.flatMap((child, index) => {
		const share = outer[index] ?? 0;
		if (child.kind === 'pane' || child.direction !== node.direction) {
			return [{ node: child, size: share }];
		}
		const inner = childSizes(child);
		return child.children.map((grandchild, innerIndex) => ({
			node: grandchild,
			size: share * (inner[innerIndex] ?? 0),
		}));
	});
	const even = sizesEqual(flattened.map(({ size }) => size));
	return { ...node, children: flattened.map(({ node: child, size }) => withSize(child, even ? undefined : size)) };
}

/**
 * Resize a split's children to `sizes`, their shares in order. Children whose size changed or that were already resized
 * keep their new size. If the changed children end up within `snap` of where they'd be without sizes, they go back to
 * sharing the space evenly.
 */
export function resizeChildren(split: Split, sizes: readonly number[], snap: number): Split {
	if (sizes.length !== split.children.length) {
		return split;
	}

	const current = childSizes(split);
	const changed = sizes.map((size, index) => Math.abs(size - (current[index] ?? 0)) > 1e-6);
	const resized = split.children.map((child, index) =>
		changed[index] === true || child.size !== undefined ? withSize(child, sizes[index]) : child,
	);
	const even = resized.map((child, index) => (changed[index] === true ? withSize(child, undefined) : child));
	const snapped = childSizes({ ...split, children: even }).every(
		(size, index) => Math.abs(size - (sizes[index] ?? 0)) <= snap,
	);
	return { ...split, children: snapped ? even : resized };
}

/** Let the two children beside a split's divider (after the child at `index`) share their space evenly again */
export function resetChildren(split: Split, index: number): Split {
	return {
		...split,
		children: split.children.map((child, childIndex) =>
			childIndex === index || childIndex === index + 1 ? withSize(child, undefined) : child,
		),
	};
}

/**
 * Raise shares smaller than their `minimums` to them, taking the difference from the other children in proportion to how
 * far they are above theirs. Without this, the layout library would take it all from the neighbors.
 */
export function fitSizes(sizes: readonly number[], minimums: readonly number[]): number[] {
	const raised = sizes.map((size, index) => Math.max(size, minimums[index] ?? 0));
	const total = raised.reduce((sum, size) => sum + size, 0);
	const room = raised.map((size, index) => size - (minimums[index] ?? 0));
	const totalRoom = room.reduce((sum, size) => sum + size, 0);
	if (total <= 1 + 1e-9) {
		return [...sizes];
	}
	if (totalRoom <= 1e-9) {
		return raised.map((size) => size / total);
	}
	return raised.map((size, index) => size - ((total - 1) * (room[index] ?? 0)) / totalRoom);
}
