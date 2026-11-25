import { useDroppable } from '@dnd-kit/react';
import ChevronRightIcon from 'lucide-react/icons/chevron-right';
import { useMemo, useState } from 'react';
import { Divider } from '@astryxdesign/core/Divider';
import type { EditedWidget } from '@/entries/edited-widget';
import type { EntrySectionDropData } from '@/entries/drag';
import { EntryRows } from '@/entries/entry-browser-rows';
import { SectionHeaderLabel } from '@/entries/section-header-label';
import { toggleSearchGroups, type EntryTreeNode, entryTreeView } from '@/entries/tree';
import { cn } from '@/lib/utils';

/** Hidden entries and groups, collapsed by default and kept at the bottom of the entry browser */
export function HiddenSection({
	nodes,
	query,
	searchToggled,
	onSearchExpandedChange,
	dropTarget,
	edited,
}: {
	nodes: EntryTreeNode[];
	query: string;
	searchToggled: ReadonlySet<string>;
	onSearchExpandedChange: (expanded: string[], next: string[]) => void;
	dropTarget: boolean;
	edited: EditedWidget | undefined;
}) {
	const [open, setOpen] = useState(false);
	const [expanded, setExpanded] = useState<string[]>([]);
	const results = useMemo(() => entryTreeView(nodes, expanded, query, 'hidden'), [nodes, expanded, query]);
	const view = useMemo(() => toggleSearchGroups(results, searchToggled, 'hidden'), [results, searchToggled]);
	const { ref } = useDroppable<EntrySectionDropData>({
		id: 'hidden',
		accept: (source) => source.data['section'] !== undefined,
		data: { section: 'hidden' },
	});

	return (
		<section
			ref={ref}
			aria-label="Hidden entries"
			className={cn('flex max-h-1/2 min-h-0 shrink-0 flex-col', dropTarget && 'bg-primary/8')}
		>
			<Divider />
			<button
				type="button"
				aria-expanded={open}
				className="mx-2 flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2.5 outline-none hover:bg-accent focus-visible:bg-accent"
				onClick={() => setOpen(!open)}
			>
				<ChevronRightIcon
					className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')}
				/>
				<SectionHeaderLabel section="hidden" count={view.items.length} />
			</button>
			{open && (
				<EntryRows
					view={view}
					label="Hidden entries"
					className="min-h-0"
					// The whole section shows where rows will be dropped
					dropSection={undefined}
					edited={edited}
					onExpandedChange={(next) => {
						if (view.highlights) {
							onSearchExpandedChange(view.expanded, next);
						} else {
							setExpanded(next);
						}
					}}
				/>
			)}
		</section>
	);
}
