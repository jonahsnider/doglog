import * as z from 'zod';
import { createId } from '@/lib/random-id';
import { normalize, resetChildren, resizeChildren } from '@/panes/split-sizes';

/** The widget shown in a pane, `config` holds its bindings (see `@/widgets/bindings`) */
const widgetSchema = z.object({
	type: z.string(),
	config: z.unknown(),
});

export type Widget = z.infer<typeof widgetSchema>;

/** A pane or split's share of its parent split, set by resizing it. Without one, it shares what's left evenly. */
const sizeSchema = z.number().gt(0).lt(1).optional().catch(undefined);

const paneSchema = z.object({
	kind: z.literal('pane'),
	id: z.string(),
	/** `undefined` for an empty pane, an invalid widget leaves the pane empty */
	widget: widgetSchema.optional().catch(undefined),
	size: sizeSchema,
});

export type Pane = z.infer<typeof paneSchema>;

/** `row` lays the children out side by side, `column` stacks them */
const splitDirectionSchema = z.enum(['row', 'column']);

export type SplitDirection = z.infer<typeof splitDirectionSchema>;

export type Split = {
	kind: 'split';
	id: string;
	direction: SplitDirection;
	/** Share of its parent split, see `Pane['size']` */
	size?: number | undefined;
	/** At least two, left to right or top to bottom. Splitting a pane in the same direction adds a child instead of nesting a split. */
	children: PaneNode[];
};

/** A dashboard's layout, a tree of splits with a pane at each leaf */
export type PaneNode = Pane | Split;

/** Most panes lined up in one direction, so they're each at least a quarter of the dashboard's width or height */
export const maxPanesAlong = 4;

export function createPane(): Pane {
	return { kind: 'pane', id: createId() };
}

function replaceNode(node: PaneNode, id: string, update: (node: PaneNode) => PaneNode): PaneNode {
	if (node.id === id) {
		return update(node);
	}

	if (node.kind === 'pane') {
		return node;
	}

	return { ...node, children: node.children.map((child) => replaceNode(child, id, update)) };
}

/** The split holding the node with ID `id` */
export function findParent(layout: PaneNode, id: string): Split | undefined {
	if (layout.kind === 'pane') {
		return undefined;
	}

	return layout.children.some((child) => child.id === id)
		? layout
		: layout.children.reduce<Split | undefined>((found, child) => found ?? findParent(child, id), undefined);
}

/**
 * Put `node` beside the node with ID `targetId`. Next to a node in a split in the same direction, it's added to that
 * split, taking half of the target's size if it was resized. Otherwise the target is split in two.
 */
function insertBeside(
	layout: PaneNode,
	targetId: string,
	direction: SplitDirection,
	node: PaneNode,
	before: boolean,
): PaneNode {
	const inserted = { ...node, size: undefined };
	const parent = findParent(layout, targetId);
	if (parent?.direction === direction) {
		return replaceNode(layout, parent.id, (split) =>
			split.kind === 'pane'
				? split
				: {
						...split,
						children: split.children.flatMap((child) => {
							if (child.id !== targetId) {
								return [child];
							}
							const size = child.size === undefined ? undefined : child.size / 2;
							const pair = [
								{ ...child, size },
								{ ...inserted, size },
							];
							return before ? pair.toReversed() : pair;
						}),
					},
		);
	}

	return replaceNode(layout, targetId, (target) => {
		const moved = { ...target, size: undefined };
		return {
			kind: 'split',
			id: createId(),
			direction,
			size: target.size,
			children: before ? [inserted, moved] : [moved, inserted],
		};
	});
}

/** Split a pane, `newPane` goes after (right of or below) the existing one */
export function splitPane(
	layout: PaneNode,
	paneId: string,
	direction: SplitDirection,
	newPane: Pane = createPane(),
): PaneNode {
	return insertBeside(layout, paneId, direction, newPane, false);
}

/** Most panes lined up one after another in `direction`, e.g. the most columns for `row` */
export function panesAlong(node: PaneNode, direction: SplitDirection): number {
	if (node.kind === 'pane') {
		return 1;
	}

	const counts = node.children.map((child) => panesAlong(child, direction));
	return node.direction === direction ? counts.reduce((sum, count) => sum + count, 0) : Math.max(...counts);
}

/** Whether a pane can be split without making panes too small to use */
export function canSplitPane(layout: PaneNode, paneId: string, direction: SplitDirection): boolean {
	return (
		findPane(layout, paneId) !== undefined &&
		panesAlong(splitPane(layout, paneId, direction), direction) <= maxPanesAlong
	);
}

/** Put layouts side by side, each taking an equal share of the width. No layouts make an empty pane. */
export function joinLayouts(layouts: readonly PaneNode[]): PaneNode {
	const [first, second] = layouts;
	if (!first || !second) {
		return first ?? createPane();
	}

	return normalize({
		kind: 'split',
		id: createId(),
		direction: 'row',
		children: layouts.map((layout) => ({ ...layout, size: undefined })),
	});
}

/** Whether layouts can be put side by side without making panes too small to use */
export function canJoinLayouts(layouts: readonly PaneNode[]): boolean {
	return panesAlong(joinLayouts(layouts), 'row') <= maxPanesAlong;
}

/** Which side of another pane a moved pane goes on */
export type PaneSide = 'left' | 'right' | 'top' | 'bottom';

function sideDirection(side: PaneSide): SplitDirection {
	return side === 'left' || side === 'right' ? 'row' : 'column';
}

function moveResult(layout: PaneNode, paneId: string, targetId: string, side: PaneSide): PaneNode | undefined {
	const pane = findPane(layout, paneId);
	if (!pane || layout.id === paneId || paneId === targetId) {
		return undefined;
	}

	const without = closePane(layout, paneId);
	if (!findPane(without, targetId)) {
		return undefined;
	}

	const direction = sideDirection(side);
	const result = insertBeside(without, targetId, direction, pane, side === 'left' || side === 'top');
	return panesAlong(result, direction) <= maxPanesAlong ? result : undefined;
}

/** Whether a pane can be moved beside another without making panes too small to use */
export function canMovePane(layout: PaneNode, paneId: string, targetId: string, side: PaneSide): boolean {
	return moveResult(layout, paneId, targetId, side) !== undefined;
}

/** Move a pane to `side` of another pane, the panes around its old place take its space. Does nothing if `canMovePane()` is false. */
export function movePane(layout: PaneNode, paneId: string, targetId: string, side: PaneSide): PaneNode {
	return moveResult(layout, paneId, targetId, side) ?? layout;
}

/** Remove a pane so the panes beside it take its space. Closing the only pane leaves an empty pane. */
export function closePane(layout: PaneNode, paneId: string): PaneNode {
	if (layout.id === paneId) {
		return createPane();
	}

	const remove = (node: PaneNode): PaneNode =>
		node.kind === 'pane'
			? node
			: { ...node, children: node.children.filter((child) => child.id !== paneId).map((child) => remove(child)) };
	return normalize(remove(layout));
}

/** The node beside a pane that's focused when it's closed: the one before it, or after it for the first. `undefined` for the only pane. */
export function findSibling(layout: PaneNode, paneId: string): PaneNode | undefined {
	const parent = findParent(layout, paneId);
	const index = parent?.children.findIndex((child) => child.id === paneId) ?? -1;
	return parent?.children[index === 0 ? 1 : index - 1];
}

export function findPane(layout: PaneNode, paneId: string): Pane | undefined {
	if (layout.kind === 'pane') {
		return layout.id === paneId ? layout : undefined;
	}

	return layout.children.reduce<Pane | undefined>((found, child) => found ?? findPane(child, paneId), undefined);
}

/** IDs of the layout's panes, top left first */
export function paneIds(layout: PaneNode): string[] {
	return layout.kind === 'pane' ? [layout.id] : layout.children.flatMap((child) => paneIds(child));
}

/** The layout's panes, top left first */
export function panes(layout: PaneNode): Pane[] {
	return layout.kind === 'pane' ? [layout] : layout.children.flatMap((child) => panes(child));
}

/** The top left pane */
export function firstPane(layout: PaneNode): Pane {
	return layout.kind === 'pane' ? layout : firstPane(layout.children[0] ?? createPane());
}

/** Set a pane's widget, or clear it with `undefined` */
export function setPaneWidget(layout: PaneNode, paneId: string, widget: Widget | undefined): PaneNode {
	return replaceNode(layout, paneId, (node) => {
		if (node.kind !== 'pane') {
			return node;
		}

		const { widget: _, ...pane } = node;
		return widget ? { ...pane, widget } : pane;
	});
}

/** Resize a split's children to `sizes`, their shares in order, see `resizeChildren()` */
export function resizeSplit(layout: PaneNode, splitId: string, sizes: readonly number[], snap = 0): PaneNode {
	return replaceNode(layout, splitId, (node) => (node.kind === 'pane' ? node : resizeChildren(node, sizes, snap)));
}

/** Let the two children beside a split's divider share their space evenly again */
export function resetDivider(layout: PaneNode, splitId: string, index: number): PaneNode {
	return replaceNode(layout, splitId, (node) => (node.kind === 'pane' ? node : resetChildren(node, index)));
}

const splitSchema = z.object({
	kind: z.literal('split'),
	id: z.string(),
	direction: splitDirectionSchema,
	size: sizeSchema,
	get children() {
		return z.array(paneNodeSchema).min(1);
	},
});

export const paneNodeSchema: z.ZodType<PaneNode> = z
	.discriminatedUnion('kind', [paneSchema, splitSchema])
	.transform((node) => normalize(node));
