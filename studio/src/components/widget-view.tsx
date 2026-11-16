import type { Draggable, Droppable } from '@dnd-kit/dom';
import { useDragOperation, useDroppable } from '@dnd-kit/react';
import { DatabaseIcon, ListPlusIcon } from 'lucide-react';
import { type CSSProperties, type ReactNode, useMemo } from 'react';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { getEntry, useEntries } from '@/data/data-store';
import { formatEntryType } from '@/data/samples';
import { useSource } from '@/data/source';
import { type EntryDragData, type EntryDropData, entryDragType, WidgetEntriesContext } from '@/entry-drag';
import { cn } from '@/lib/utils';
import { acceptsEntry, type WidgetBinding, type WidgetType } from '@/widgets/widget-type';

/** Renders a widget with its bound entries, handles the shared empty and "no data" states, and shows where dragged entries will be dropped */
export function WidgetView({
	paneId,
	type,
	entryNames,
}: {
	paneId: string;
	type: WidgetType;
	entryNames: readonly string[];
}) {
	const source = useSource();
	const entries = useEntries();
	// Accepts every entry so rejected ones can explain why they can't be dropped. Entries from this widget are reordered by dropping them on each other instead.
	const { ref } = useDroppable<EntryDropData>({
		id: paneId,
		accept: (draggable) => draggable.type === entryDragType && draggable.data['paneId'] !== paneId,
		data: { paneId },
	});
	const widgetEntries = useMemo(() => ({ paneId, entryNames }), [paneId, entryNames]);

	const bindings = useMemo((): WidgetBinding[] => {
		const byName = new Map(entries.map((entry) => [entry.name, entry]));
		return entryNames.map((name) => {
			const entry = byName.get(name);
			return { name, entry: entry && acceptsEntry(type, entry) ? entry : undefined };
		});
	}, [entries, entryNames, type]);

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
			<WidgetEntriesContext value={widgetEntries}>
				<div className="h-full overflow-auto">{content}</div>
			</WidgetEntriesContext>
			<DropFeedback paneId={paneId} type={type} entryNames={entryNames} />
		</div>
	);
}

/** Where an entry dragged over the widget will go, or why it can't be dropped */
function DropFeedback({
	paneId,
	type,
	entryNames,
}: {
	paneId: string;
	type: WidgetType;
	entryNames: readonly string[];
}) {
	const { source, target } = useDragOperation<
		EntryDragData | EntryDropData,
		Draggable<EntryDragData>,
		Droppable<EntryDropData>
	>();
	const drop = target?.data;
	const dragged = drop?.paneId === paneId ? source?.data : undefined;
	if (!dragged) {
		return undefined;
	}

	if (drop?.index !== undefined) {
		return <ReorderIndicator from={entryNames.indexOf(dragged.name)} drop={drop} element={target?.element} />;
	}

	const entry = getEntry(dragged.name);
	let rejection: string | undefined;
	if (entry && !acceptsEntry(type, entry)) {
		rejection = `${type.name} doesn't accept ${formatEntryType(entry.type)} entries`;
	} else if (entryNames.includes(dragged.name)) {
		rejection = `Already showing ${dragged.name}`;
	}
	return (
		<div
			className={cn(
				'pointer-events-none absolute inset-1 flex items-center justify-center rounded-lg border-2 border-dashed p-4 text-center text-sm font-medium backdrop-blur-xs',
				rejection === undefined
					? 'border-primary bg-primary/8 text-foreground'
					: 'border-destructive bg-destructive/8 text-destructive-foreground',
			)}
		>
			{rejection ?? `Drop to show ${dragged.name}`}
		</div>
	);
}

/** A line on the side of the hovered entry that the dragged entry moves to */
function ReorderIndicator({
	from,
	drop,
	element,
}: {
	from: number;
	drop: EntryDropData;
	element: Element | undefined;
}) {
	const index = drop.index!;
	if (element === undefined || from === index) {
		return undefined;
	}

	// The dragged entry takes the hovered entry's position, so it goes after entries below it and before entries above it
	const after = from < index;
	const rect = element.getBoundingClientRect();
	// Fixed, so it's placed by the hovered element's viewport position no matter how the widget scrolls or nests it
	const style: CSSProperties =
		drop.orientation === 'horizontal'
			? { left: (after ? rect.right : rect.left) - 1, top: rect.top, width: 2, height: rect.height }
			: { left: rect.left, top: (after ? rect.bottom : rect.top) - 1, width: rect.width, height: 2 };
	return <div className="pointer-events-none fixed z-10 rounded-full bg-primary" style={style} />;
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
