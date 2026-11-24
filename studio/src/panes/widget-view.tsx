import type { Draggable, Droppable } from '@dnd-kit/dom';
import { useDragOperation, useDroppable } from '@dnd-kit/react';
import DatabaseIcon from 'lucide-react/icons/database';
import ListPlusIcon from 'lucide-react/icons/list-plus';
import TriangleAlertIcon from 'lucide-react/icons/triangle-exclamation-point';
import { Component, type CSSProperties, type ReactNode, Suspense, use, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
	connectBindings,
	disconnectBindings,
	maxWidgetEntries,
	setBindingPick,
	setBindingRole,
	toggleBindingHidden,
	unboundEntryNames,
	widgetEntryLimitMessage,
} from '@/widgets/bindings';
import { DashboardIdContext, DashboardLayoutContext, updateLayout } from '@/dashboards/panes';
import { getEntry } from '@/data/data-store';
import { formatEntryType } from '@/data/samples';
import { useSource } from '@/data/source';
import {
	droppedEntryName,
	droppedGroupNames,
	type EntryDragData,
	type EntryDropData,
	entryDragType,
	isEntryDrag,
	type WidgetBindings,
	WidgetBindingsContext,
} from '@/entries/drag';
import { cn } from '@/lib/utils';
import { WidgetEmpty } from '@/widgets/widget-empty';
import { setWidgetOption } from '@/widgets/options';
import { acceptsDrop, type OptionValues, type WidgetBinding, type WidgetType } from '@/widgets/widget-type';

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
	const dashboardLayout = use(DashboardLayoutContext);
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
				updateLayout(dashboardId, (layout) => setBindingPick(layout, paneId, bindingId, 'color', color)),
			setRobot: (bindingId, robot) =>
				updateLayout(dashboardId, (layout) => setBindingPick(layout, paneId, bindingId, 'robot', robot)),
			setCamera: (bindingId, camera) =>
				updateLayout(dashboardId, (layout) => setBindingPick(layout, paneId, bindingId, 'camera', camera)),
		}),
		[dashboardId, paneId, bindings],
	);
	const setOption = useCallback(
		(id: string, value: string | undefined) =>
			updateLayout(dashboardId, (layout) => setWidgetOption(layout, paneId, id, value)),
		[dashboardId, paneId],
	);
	const names = new Set(bindings.map((binding) => binding.name));
	const widget = (
		<type.component
			bindings={bindings}
			options={options}
			setOption={setOption}
			layout={dashboardLayout}
			paneId={paneId}
		/>
	);

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
				<div className="h-full overflow-auto">
					{/* A widget that crashes only replaces itself, and tries again when its entries or options change */}
					<WidgetErrorBoundary resetKey={bindings}>
						<Suspense
							fallback={
								<div data-capture-pending className="grid h-full place-items-center">
									<Spinner aria-label={`Loading ${type.name}`} className="size-4 text-muted-foreground" />
								</div>
							}
						>
							<DashboardIdContext value={dashboardId}>{content}</DashboardIdContext>
						</Suspense>
					</WidgetErrorBoundary>
				</div>
			</WidgetBindingsContext>
			<DropFeedback paneId={paneId} type={type} bindings={bindings} />
		</div>
	);
}

type ErrorBoundaryState = { error: Error | undefined; resetKey: unknown };

/** Shows a widget's error instead of the widget, until the user tries again or `resetKey` changes */
class WidgetErrorBoundary extends Component<{ resetKey: unknown; children: ReactNode }, ErrorBoundaryState> {
	override state: ErrorBoundaryState = { error: undefined, resetKey: this.props.resetKey };

	static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState> {
		return { error: error instanceof Error ? error : new Error('Unknown error') };
	}

	static getDerivedStateFromProps(props: { resetKey: unknown }, state: ErrorBoundaryState): ErrorBoundaryState | null {
		return props.resetKey === state.resetKey ? null : { error: undefined, resetKey: props.resetKey };
	}

	override render() {
		const { error } = this.state;
		if (error === undefined) {
			return this.props.children;
		}
		return (
			<WidgetEmpty icon={<TriangleAlertIcon />} title="Something went wrong" description={error.message}>
				<Button variant="outline" size="sm" onClick={() => this.setState({ error: undefined })}>
					Try again
				</Button>
			</WidgetEmpty>
		);
	}
}

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
	// Parts of a widget that set the dropped entry's role, ex. a graph's right axis, highlight themselves
	if (drop?.role !== undefined) {
		return undefined;
	}

	const { accepted, message } = entryDropFeedback(type, dragged, bindings);
	return (
		<div
			className={cn(
				'pointer-events-none absolute inset-1 flex items-center justify-center rounded-lg border-2 border-dashed p-4 text-center text-sm font-medium backdrop-blur-xs',
				accepted
					? 'border-primary bg-primary/8 text-foreground'
					: 'border-destructive bg-destructive/8 text-destructive-foreground',
			)}
		>
			{message}
		</div>
	);
}

function entryDropFeedback(type: WidgetType, dragged: EntryDragData, bindings: readonly WidgetBinding[]) {
	if (dragged.group) {
		const names = droppedGroupNames(type, dragged.group);
		const count = unboundEntryNames(bindings, names).length;
		if (count > 0 && bindings.length + count > maxWidgetEntries) {
			return { accepted: false, message: widgetEntryLimitMessage };
		}
		return {
			accepted: count > 0,
			message:
				count > 0
					? `Drop to add ${count} ${count === 1 ? 'entry' : 'entries'}`
					: names.length === 0
						? `${type.name} doesn't accept any entries in this group`
						: `${type.name} already shows all compatible entries in this group`,
		};
	}
	// A single entry can be bound again, ex. to draw a pose as a robot and a ghost
	const name = droppedEntryName(type, dragged);
	const entry = getEntry(name);
	const accepted = acceptsDrop(type, name, entry);
	if (accepted && type.optionFromEntry === undefined && bindings.length >= maxWidgetEntries) {
		return { accepted: false, message: widgetEntryLimitMessage };
	}
	return {
		accepted,
		message: accepted
			? `Drop to show ${name}`
			: entry
				? `${type.name} doesn't accept ${formatEntryType(entry.type)} entries`
				: `${type.name} doesn't accept ${name}`,
	};
}

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
