import * as z from 'zod';

/** The widget shown in a pane, `config` is owned by the widget type (ex. bound entry names) */
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

/** Split a pane in two, the new empty pane goes after (right of or below) the existing one */
export function splitPane(layout: PaneNode, paneId: string, direction: SplitDirection): PaneNode {
	return replaceNode(layout, paneId, (pane) => ({
		kind: 'split',
		id: crypto.randomUUID(),
		direction,
		ratio: 0.5,
		first: pane,
		second: createPane(),
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
