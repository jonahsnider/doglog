import type { Draggable, Droppable } from '@dnd-kit/dom';
import { useDragOperation, useDroppable } from '@dnd-kit/react';
import { DatabaseIcon, ListPlusIcon } from 'lucide-react';
import { type CSSProperties, type ReactNode, useCallback, useMemo } from 'react';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import {
	connectBindings,
	disconnectBindings,
	setBindingColor,
	setBindingRole,
	toggleBindingHidden,
} from '@/widgets/bindings';
import { updateLayout } from '@/dashboards/panes';
import { getEntry } from '@/data/data-store';
import { formatEntryType } from '@/data/samples';
import { useSource } from '@/data/source';
import {
	type EntryDragData,
	type EntryDropData,
	entryDragType,
	isEntryDrag,
	type WidgetBindings,
	WidgetBindingsContext,
} from '@/entries/drag';
import { cn } from '@/lib/utils';
import { setWidgetOption } from '@/widgets/options';
import { acceptsEntry, type OptionValues, type WidgetBinding, type WidgetType } from '@/widgets/widget-type';

/** Renders a widget with its bindings, handles the shared empty and "no data" states, and shows where dragged entries will be dropped */
export function WidgetView({
	dashboardId,
	paneId,
	type,
	bindings,
	options,
}: {
	dashboardId: string;
	paneId: string;
	type: WidgetType;
	bindings: readonly WidgetBinding[];
	options: OptionValues;
}) {
	const source = useSource();
	// Accepts every entry so rejected ones can explain why they can't be dropped. Entries from this widget are reordered by dropping them on each other instead.
	const { ref } = useDroppable<EntryDropData>({
		id: paneId,
		accept: (draggable) => draggable.type === entryDragType && draggable.data['paneId'] !== paneId,
		data: { paneId },
	});
	const widgetBindings = useMemo(
		(): WidgetBindings => ({
			paneId,
			bindings,
			setRole: (bindingId, role) =>
				updateLayout(dashboardId, (layout) => setBindingRole(layout, paneId, bindingId, role)),
			connect: (sourceId, targetId) =>
				updateLayout(dashboardId, (layout) => connectBindings(layout, paneId, sourceId, targetId)),
			disconnect: (sourceId, targetId) =>
				updateLayout(dashboardId, (layout) => disconnectBindings(layout, paneId, sourceId, targetId)),
			toggleHidden: (bindingId) =>
				updateLayout(dashboardId, (layout) => toggleBindingHidden(layout, paneId, bindingId)),
			setColor: (bindingId, color) =>
				updateLayout(dashboardId, (layout) => setBindingColor(layout, paneId, bindingId, color)),
		}),
		[dashboardId, paneId, bindings],
	);
	const setOption = useCallback(
		(id: string, value: string | undefined) =>
			updateLayout(dashboardId, (layout) => setWidgetOption(layout, paneId, id, value)),
		[dashboardId, paneId],
	);
	const names = new Set(bindings.map((binding) => binding.name));
	const widget = <type.component bindings={bindings} options={options} setOption={setOption} />;

	let content: ReactNode;
	if (type.rendersEmpty === true) {
		content = widget;
	} else if (bindings.length === 0) {
		content = (
			<WidgetEmpty
				icon={<ListPlusIcon />}
				title="No entries"
				description="Drag entries here from the entry browser, or use Edit entries."
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
					names.size === 1
						? `The current source doesn't have ${bindings[0]!.name}.`
						: "The current source doesn't have any of this widget's entries."
				}
			/>
		);
	} else {
		content = widget;
	}

	return (
		<div ref={ref} className="relative h-full">
			<WidgetBindingsContext value={widgetBindings}>
				<div className="h-full overflow-auto">{content}</div>
			</WidgetBindingsContext>
			<DropFeedback paneId={paneId} type={type} bindings={bindings} />
		</div>
	);
}

/** Where an entry dragged over the widget will go, or why it can't be dropped */
function DropFeedback({
	paneId,
	type,
	bindings,
}: {
	paneId: string;
	type: WidgetType;
	bindings: readonly WidgetBinding[];
}) {
	const { source, target } = useDragOperation<
		EntryDragData | EntryDropData,
		Draggable<EntryDragData>,
		Droppable<EntryDropData>
	>();
	const drop = target?.data;
	// Panes dragged over the widget show their own feedback
	const dragged = drop?.paneId === paneId && isEntryDrag(source) ? source.data : undefined;
	if (!dragged) {
		return undefined;
	}

	if (drop?.index !== undefined) {
		const from = bindings.findIndex((binding) => binding.id === dragged.bindingId);
		return <ReorderIndicator from={from} drop={drop} element={target?.element} />;
	}

	// Entries the widget already shows can be bound again, ex. to draw a pose as a robot and a ghost
	const entry = getEntry(dragged.name);
	const rejection =
		entry && !acceptsEntry(type, entry)
			? `${type.name} doesn't accept ${formatEntryType(entry.type)} entries`
			: undefined;
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
