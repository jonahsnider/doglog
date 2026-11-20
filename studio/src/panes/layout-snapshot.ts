import * as z from 'zod';
import { createId } from '@/lib/random-id';
import type { Pane, PaneNode, Split, Widget } from '@/panes/layout';
import { type Binding, bindingSchema } from '@/widgets/bindings';

type BindingSnapshot = Omit<Binding, 'id' | 'sources'> & { connectedFrom?: number[] };

type WidgetSnapshot =
	| (Widget & { bindings?: undefined })
	| { type: string; config: Record<string, unknown>; bindings: BindingSnapshot[] };

type LayoutSnapshot =
	| (Omit<Pane, 'id' | 'widget'> & { widget?: WidgetSnapshot })
	| (Omit<Split, 'id' | 'children'> & { children: LayoutSnapshot[] });

// Keep saved config fields even if this version of Studio doesn't use them.
const widgetConfigSchema = z.looseObject({ bindings: z.array(bindingSchema.loose()).catch([]).optional() });

function snapshotWidget(widget: Widget): WidgetSnapshot {
	const parsed = widgetConfigSchema.safeParse(widget.config);
	if (!parsed.success || parsed.data.bindings === undefined) {
		return widget;
	}
	const { bindings, ...config } = parsed.data;
	const positions = new Map(bindings.map(({ id }, index) => [id, index]));
	return {
		type: widget.type,
		config,
		bindings: bindings.map((stored) => {
			const { id: _, sources, ...binding } = stored;
			return Object.assign(binding, { connectedFrom: sources?.flatMap((source) => positions.get(source) ?? []) });
		}),
	};
}

function restoreWidget(widget: WidgetSnapshot): Widget {
	if (widget.bindings === undefined) {
		return widget;
	}
	const ids = widget.bindings.map(() => createId());
	return {
		type: widget.type,
		config: {
			...widget.config,
			bindings: widget.bindings.map(({ connectedFrom, ...binding }, index) => ({
				...binding,
				id: ids[index]!,
				sources: connectedFrom?.map((source) => ids[source]!),
			})),
		},
	};
}

/** A layout without IDs; connections refer to positions in a widget's binding list. */
export function snapshotLayout(node: PaneNode): LayoutSnapshot {
	if (node.kind === 'pane') {
		const { id: _, widget, ...pane } = node;
		return { ...pane, widget: widget && snapshotWidget(widget) };
	}
	const { id: _, children, ...split } = node;
	return { ...split, children: children.map((child) => snapshotLayout(child)) };
}

/** Make an independent editable layout from a snapshot, assigning fresh IDs. */
export function restoreLayout(node: LayoutSnapshot): PaneNode {
	const id = createId();
	return node.kind === 'pane'
		? { ...node, id, widget: node.widget && restoreWidget(node.widget) }
		: { ...node, id, children: node.children.map((child) => restoreLayout(child)) };
}
