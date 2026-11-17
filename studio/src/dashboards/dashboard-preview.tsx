import type { PaneNode } from '@/panes/layout';
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

	return (
		<div className={cn('flex size-full gap-1', node.direction === 'column' && 'flex-col')}>
			{/* Basis 0 so each side's share of the space matches the split's ratio */}
			<div className="flex min-h-0 min-w-0" style={{ flex: `${node.ratio} 1 0` }}>
				<PreviewNode node={node.first} />
			</div>
			<div className="flex min-h-0 min-w-0" style={{ flex: `${1 - node.ratio} 1 0` }}>
				<PreviewNode node={node.second} />
			</div>
		</div>
	);
}
