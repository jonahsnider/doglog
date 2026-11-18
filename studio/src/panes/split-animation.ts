import { findPane, type PaneNode, type Split } from '@/panes/layout';
import { childSizes, fitSizes } from '@/panes/split-sizes';

/**
 * A split's children resizing as a new one grows in from nothing, or as a closed pane shrinks away. `split` is the split
 * from before, which still holds the closed pane.
 */
export type SplitAnimation =
	| { kind: 'open'; childId: string; split: Split }
	| { kind: 'close'; childId: string; split: Split };

/** How the layout changed from `previous` to `node` at the same place in it, to animate its splits */
export function splitAnimation(previous: PaneNode, node: PaneNode, layout: PaneNode): SplitAnimation | undefined {
	// A pane split in two, as a split with the pane and the new pane
	if (previous.kind === 'pane' && node.kind === 'split' && node.children.length === 2) {
		const added = node.children.find((child) => child.id !== previous.id);
		return added && node.children.some((child) => child.id === previous.id)
			? { kind: 'open', childId: added.id, split: { ...node, children: [previous] } }
			: undefined;
	}

	if (previous.kind !== 'split') {
		return undefined;
	}

	const current = node.kind === 'split' && node.id === previous.id ? node.children : [node];
	const added = current.filter((child) => !previous.children.some((other) => other.id === child.id));
	const removed = previous.children.filter((child) => !current.some((other) => other.id === child.id));
	const [addedChild] = added;
	const [removedChild] = removed;
	if (node.id === previous.id && addedChild && added.length === 1 && removed.length === 0) {
		return { kind: 'open', childId: addedChild.id, split: previous };
	}

	// A pane moved somewhere else in the layout is already shown there
	if (
		removedChild?.kind === 'pane' &&
		removed.length === 1 &&
		added.length === 0 &&
		previous.children.length === current.length + 1 &&
		!findPane(layout, removedChild.id)
	) {
		return { kind: 'close', childId: removedChild.id, split: previous };
	}

	return undefined;
}

/** Each child's share of a split as a percentage by ID, at least its share of `minimum(child)` */
export function percentages(split: Split, minimum: (child: PaneNode) => number): Record<string, number> {
	const sizes = fitSizes(
		childSizes(split),
		split.children.map((child) => minimum(child)),
	);
	return Object.fromEntries(split.children.map((child, index) => [child.id, (sizes[index] ?? 0) * 100]));
}

/** The split shown while a pane closes: the closed pane is kept until it has shrunk away, beside the latest version of the nodes taking its place */
export function closingSplit(animation: SplitAnimation, node: PaneNode): Split {
	const { split, childId } = animation;
	const same = node.kind === 'split' && node.id === split.id;
	const current = same ? node.children : [node];
	const index = split.children.findIndex((child) => child.id === childId);
	const closed = split.children[index];
	return {
		...(same ? node : split),
		children: closed ? [...current.slice(0, index), closed, ...current.slice(index)] : current,
	};
}
