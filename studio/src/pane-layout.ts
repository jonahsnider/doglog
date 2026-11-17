import * as z from 'zod';

/** The widget shown in a pane, `config` holds its bindings (see `@/bindings`) */
const widgetSchema = z.object({
	type: z.string(),
	config: z.unknown(),
});

export type Widget = z.infer<typeof widgetSchema>;

const paneSchema = z.object({
	kind: z.literal('pane'),
	id: z.string(),
	/** `undefined` for an empty pane, an invalid widget leaves the pane empty */
	widget: widgetSchema.optional().catch(undefined),
});

export type Pane = z.infer<typeof paneSchema>;

/** `row` lays the children out side by side, `column` stacks them */
const splitDirectionSchema = z.enum(['row', 'column']);

export type SplitDirection = z.infer<typeof splitDirectionSchema>;

export type Split = {
	kind: 'split';
	id: string;
	direction: SplitDirection;
	/** Fraction of the space given to `first` */
	ratio: number;
	first: PaneNode;
	second: PaneNode;
};

/** A dashboard's layout, a binary tree of splits with a pane at each leaf */
export type PaneNode = Pane | Split;

function clampRatio(ratio: number): number {
	return Math.min(Math.max(ratio, 0.1), 0.9);
}

export function createPane(): Pane {
	return { kind: 'pane', id: crypto.randomUUID() };
}

/** Replace the node with ID `id` using `update` */
function replaceNode(node: PaneNode, id: string, update: (node: PaneNode) => PaneNode): PaneNode {
	if (node.id === id) {
		return update(node);
	}

	if (node.kind === 'pane') {
		return node;
	}

	return { ...node, first: replaceNode(node.first, id, update), second: replaceNode(node.second, id, update) };
}

/** Split a pane in two, `newPane` goes after (right of or below) the existing one */
export function splitPane(
	layout: PaneNode,
	paneId: string,
	direction: SplitDirection,
	newPane: Pane = createPane(),
): PaneNode {
	return replaceNode(layout, paneId, (pane) => ({
		kind: 'split',
		id: crypto.randomUUID(),
		direction,
		ratio: 0.5,
		first: pane,
		second: newPane,
	}));
}

/** Most splits in one direction above a pane, so panes are at least a quarter of the dashboard's width and height */
const maxSplitDepth = 2;

/** Splits in `direction` above a pane, `undefined` if the pane isn't in the layout */
function splitDepth(node: PaneNode, paneId: string, direction: SplitDirection): number | undefined {
	if (node.kind === 'pane') {
		return node.id === paneId ? 0 : undefined;
	}

	const depth = splitDepth(node.first, paneId, direction) ?? splitDepth(node.second, paneId, direction);
	return depth === undefined || node.direction !== direction ? depth : depth + 1;
}

/** Whether a pane can be split without making panes too small to use */
export function canSplitPane(layout: PaneNode, paneId: string, direction: SplitDirection): boolean {
	const depth = splitDepth(layout, paneId, direction);
	return depth !== undefined && depth < maxSplitDepth;
}

/** Most splits in `direction` above any one pane */
function deepestSplit(node: PaneNode, direction: SplitDirection): number {
	if (node.kind === 'pane') {
		return 0;
	}

	const depth = Math.max(deepestSplit(node.first, direction), deepestSplit(node.second, direction));
	return node.direction === direction ? depth + 1 : depth;
}

/** Whether two layouts can be put side by side without making panes too small to use */
export function canJoinLayouts(first: PaneNode, second: PaneNode): boolean {
	return deepestSplit(first, 'row') < maxSplitDepth && deepestSplit(second, 'row') < maxSplitDepth;
}

/** Put two layouts side by side, each taking half the space */
export function joinLayouts(first: PaneNode, second: PaneNode): PaneNode {
	return { kind: 'split', id: crypto.randomUUID(), direction: 'row', ratio: 0.5, first, second };
}

/** Which side of another pane a moved pane goes on */
export type PaneSide = 'left' | 'right' | 'top' | 'bottom';

function sideDirection(side: PaneSide): SplitDirection {
	return side === 'left' || side === 'right' ? 'row' : 'column';
}

/** Whether a pane can be moved beside another without making panes too small to use */
export function canMovePane(layout: PaneNode, paneId: string, targetId: string, side: PaneSide): boolean {
	return (
		layout.id !== paneId &&
		paneId !== targetId &&
		findPane(layout, paneId) !== undefined &&
		canSplitPane(closePane(layout, paneId), targetId, sideDirection(side))
	);
}

/** Move a pane to `side` of another pane, its sibling takes its old space. Does nothing if `canMovePane()` is false. */
export function movePane(layout: PaneNode, paneId: string, targetId: string, side: PaneSide): PaneNode {
	const pane = findPane(layout, paneId);
	if (!pane || !canMovePane(layout, paneId, targetId, side)) {
		return layout;
	}

	const before = side === 'left' || side === 'top';
	return replaceNode(closePane(layout, paneId), targetId, (target) => ({
		kind: 'split',
		id: crypto.randomUUID(),
		direction: sideDirection(side),
		ratio: 0.5,
		first: before ? pane : target,
		second: before ? target : pane,
	}));
}

/** Remove a pane so its sibling takes its space. Closing the only pane leaves an empty pane. */
export function closePane(layout: PaneNode, paneId: string): PaneNode {
	if (layout.id === paneId) {
		return createPane();
	}

	if (layout.kind === 'pane') {
		return layout;
	}

	if (layout.first.id === paneId) {
		return layout.second;
	}

	if (layout.second.id === paneId) {
		return layout.first;
	}

	return { ...layout, first: closePane(layout.first, paneId), second: closePane(layout.second, paneId) };
}

/** The node that takes a pane's place when it's closed, `undefined` for the only pane */
export function findSibling(layout: PaneNode, paneId: string): PaneNode | undefined {
	if (layout.kind === 'pane') {
		return undefined;
	}

	if (layout.first.id === paneId) {
		return layout.second;
	}

	if (layout.second.id === paneId) {
		return layout.first;
	}

	return findSibling(layout.first, paneId) ?? findSibling(layout.second, paneId);
}

export function findPane(layout: PaneNode, paneId: string): Pane | undefined {
	if (layout.kind === 'pane') {
		return layout.id === paneId ? layout : undefined;
	}

	return findPane(layout.first, paneId) ?? findPane(layout.second, paneId);
}

/** The first pane showing a widget type, in layout order (top left first) */
export function findWidgetPane(layout: PaneNode, widgetType: string): Pane | undefined {
	if (layout.kind === 'pane') {
		return layout.widget?.type === widgetType ? layout : undefined;
	}

	return findWidgetPane(layout.first, widgetType) ?? findWidgetPane(layout.second, widgetType);
}

/** The top left pane */
export function firstPane(layout: PaneNode): Pane {
	return layout.kind === 'pane' ? layout : firstPane(layout.first);
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

export function resizeSplit(layout: PaneNode, splitId: string, ratio: number): PaneNode {
	return replaceNode(layout, splitId, (node) => (node.kind === 'split' ? { ...node, ratio: clampRatio(ratio) } : node));
}

const splitSchema = z.object({
	kind: z.literal('split'),
	id: z.string(),
	direction: splitDirectionSchema,
	ratio: z.number().catch(0.5).transform(clampRatio),
	get first() {
		return paneNodeSchema;
	},
	get second() {
		return paneNodeSchema;
	},
});

/** Validates a stored layout */
export const paneNodeSchema: z.ZodType<PaneNode> = z.discriminatedUnion('kind', [paneSchema, splitSchema]);
