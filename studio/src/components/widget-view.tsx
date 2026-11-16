import { useDragDropMonitor, useDragOperation, useDroppable } from '@dnd-kit/react';
import { DatabaseIcon, ListPlusIcon } from 'lucide-react';
import { type ReactNode, useId, useMemo } from 'react';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { useEntries } from '@/data/data-store';
import { formatEntryType } from '@/data/samples';
import { useSource } from '@/data/source';
import { type EntryDragData, entryDragType } from '@/entry-drag';
import { cn } from '@/lib/utils';
import { acceptsEntry, type WidgetBinding, type WidgetType } from '@/widgets/widget-type';

/** Renders a widget with its bound entries, handles the shared empty and "no data" states, and binds entries dropped on it */
export function WidgetView({
	type,
	entryNames,
	onEntryNamesChange,
}: {
	type: WidgetType;
	entryNames: readonly string[];
	onEntryNamesChange: (entryNames: string[]) => void;
}) {
	const source = useSource();
	const entries = useEntries();
	const dropId = useId();
	// Accepts every entry so rejected ones can explain why they can't be dropped
	const { ref, isDropTarget } = useDroppable({ id: dropId, accept: entryDragType });
	const { source: dragSource } = useDragOperation<EntryDragData>();
	const draggedEntry = isDropTarget ? dragSource?.data.entry : undefined;

	const bindings = useMemo((): WidgetBinding[] => {
		const byName = new Map(entries.map((entry) => [entry.name, entry]));
		return entryNames.map((name) => {
			const entry = byName.get(name);
			return { name, entry: entry && acceptsEntry(type, entry) ? entry : undefined };
		});
	}, [entries, entryNames, type]);

	useDragDropMonitor<EntryDragData>({
		onDragEnd: ({ operation, canceled }) => {
			const entry = operation.source?.data.entry;
			if (
				!canceled &&
				operation.target?.id === dropId &&
				entry &&
				acceptsEntry(type, entry) &&
				!entryNames.includes(entry.name)
			) {
				onEntryNamesChange([...entryNames, entry.name]);
			}
		},
	});

	let content: ReactNode;
	if (entryNames.length === 0) {
		content = (
			<WidgetEmpty
				icon={<ListPlusIcon />}
				title="No entries"
				description="Drag entries here from the entry browser, or choose them in the widget options."
			/>
		);
	} else if (!source) {
		content = <WidgetEmpty icon={<DatabaseIcon />} title="No data" description="Open a log or connect to a robot." />;
	} else if (bindings.every((binding) => binding.entry === undefined)) {
		content = (
			<WidgetEmpty
				icon={<DatabaseIcon />}
				title="No data"
				description={
					entryNames.length === 1
						? `The current source doesn't have ${entryNames[0]}.`
						: "The current source doesn't have any of this widget's entries."
				}
			/>
		);
	} else {
		content = <type.component bindings={bindings} />;
	}

	return (
		<div ref={ref} className="relative h-full">
			<div className="h-full overflow-auto">{content}</div>
			{draggedEntry && (
				<div
					className={cn(
						'pointer-events-none absolute inset-1 flex items-center justify-center rounded-lg border-2 border-dashed p-4 text-center text-sm font-medium backdrop-blur-xs',
						acceptsEntry(type, draggedEntry)
							? 'border-primary bg-primary/8 text-foreground'
							: 'border-destructive bg-destructive/8 text-destructive-foreground',
					)}
				>
					{acceptsEntry(type, draggedEntry)
						? `Drop to show ${draggedEntry.name}`
						: `${type.name} doesn't accept ${formatEntryType(draggedEntry.type)} entries`}
				</div>
			)}
		</div>
	);
}

function WidgetEmpty({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
	return (
		<Empty className="h-full py-6 md:py-6">
			<EmptyHeader>
				<EmptyMedia variant="icon">{icon}</EmptyMedia>
				<EmptyTitle>{title}</EmptyTitle>
				<EmptyDescription>{description}</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
}
