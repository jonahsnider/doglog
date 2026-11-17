import type { PaneNode } from '@/panes/layout';
import { childSizes } from '@/panes/split-sizes';
import { cn } from '@/lib/utils';
import { getWidgetType } from '@/widgets/registry';

/** A miniature of a dashboard's layout, each pane showing its widget's icon */
export function DashboardPreview({ layout }: { layout: PaneNode }) {
	return (
		<div className="flex aspect-video w-48">
			<PreviewNode node={layout} />
		</div>
	);
}

function PreviewNode({ node }: { node: PaneNode }) {
	if (node.kind === 'pane') {
		const Icon = node.widget === undefined ? undefined : getWidgetType(node.widget.type)?.icon;
		return (
			<div className="flex size-full items-center justify-center rounded-sm border bg-muted text-muted-foreground">
				{Icon && <Icon className="size-4" />}
			</div>
		);
	}

	const sizes = childSizes(node);
	return (
		<div className={cn('flex size-full gap-1', node.direction === 'column' && 'flex-col')}>
			{node.children.map((child, index) => (
				// Basis 0 so each child's share of the space matches its size
				<div key={child.id} className="flex min-h-0 min-w-0" style={{ flex: `${sizes[index]} 1 0` }}>
					<PreviewNode node={child} />
				</div>
			))}
		</div>
	);
}
