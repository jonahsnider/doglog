import { useMemo } from 'react';
import { Separator as Divider } from '@/components/ui/separator';
import type { EditedWidget } from '@/entries/edited-widget';
import { EntryRows } from '@/entries/entry-browser-rows';
import { SectionHeaderLabel } from '@/entries/section-header-label';
import { type EntryTreeNode, entryTreeView } from '@/entries/tree';

/**
 * The entries the edited widget showed when editing it started, listed again at the top of the entry browser.
 * Unbinding one keeps it here, so rows don't move while toggling them.
 */
export function ActiveSection({
	nodes,
	query,
	edited,
}: {
	nodes: EntryTreeNode[];
	query: string;
	edited: EditedWidget;
}) {
	const view = useMemo(() => entryTreeView(nodes, [], query, 'active'), [nodes, query]);
	if (view.items.length === 0) {
		return null;
	}

	return (
		<section aria-label="Active entries" className="flex max-h-1/3 min-h-0 shrink-0 flex-col">
			<div className="flex h-7 shrink-0 items-center gap-1.5 px-4.5">
				{/* Counts matches while searching */}
				<SectionHeaderLabel section="active" count={view.items.length} />
			</div>
			<EntryRows
				view={view}
				label="Active entries"
				className="min-h-0"
				dropSection={undefined}
				edited={edited}
				// Its rows are all entries, there's nothing to expand
				onExpandedChange={() => undefined}
			/>
			<Divider />
		</section>
	);
}
