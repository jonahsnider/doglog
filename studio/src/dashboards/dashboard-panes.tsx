import type { Draggable, Droppable } from '@dnd-kit/dom';
import { useDragDropMonitor } from '@dnd-kit/react';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { Group, Panel, Separator, useGroupRef } from 'react-resizable-panels';
import { PaneView, type PaneNodeProps } from '@/panes/pane-view';
import { dropDashboardEntry, getFocusedPane, updateLayout } from '@/dashboards/panes';
import type { Dashboard } from '@/dashboards/dashboards';
import { type EntryDragData, type EntryDropData, type EntrySectionDropData, entryDragType } from '@/entries/drag';
import { cn } from '@/lib/utils';
import { type PaneNode, panesAlong, resizeSplit, type Split, type SplitDirection } from '@/panes/layout';

/** Smallest pane width (`row`) and height (`column`) in pixels */
type MinPaneSize = Partial<Record<SplitDirection, number>>;

/** A quarter of the dashboard, leaving room for the dividers between 4 panes */
const quarter = (size: number | undefined) => (size === undefined ? undefined : (size - 3) / 4);

/** An element's size in pixels, `undefined` until it's measured */
function useSize(ref: RefObject<HTMLElement | null>) {
	const [size, setSize] = useState<{ width: number; height: number }>();

	useEffect(() => {
		const element = ref.current!;
		const observer = new ResizeObserver(() => setSize({ width: element.clientWidth, height: element.clientHeight }));
		observer.observe(element);
		return () => observer.disconnect();
	}, [ref]);

	return size;
}

export function DashboardPanes({ dashboard }: { dashboard: Dashboard }) {
	const { layout } = dashboard;
	const focusedPaneId = getFocusedPane(dashboard).id;
	const container = useRef<HTMLDivElement>(null);
	const size = useSize(container);

	// Entries dropped on a widget or one of its entries, from the entry browser or another widget
	useDragDropMonitor<
		EntryDragData | EntryDropData | EntrySectionDropData,
		Draggable<EntryDragData>,
		Droppable<EntryDropData | EntrySectionDropData>
	>({
		onDragEnd: ({ operation, canceled }) => {
			const { source, target } = operation;
			// Entries dropped in the entry browser are moved between its sections instead
			if (!canceled && source?.type === entryDragType && target && 'paneId' in target.data) {
				const { name, paneId, bindingId } = source.data;
				const from = paneId !== undefined && bindingId !== undefined ? { paneId, bindingId } : undefined;
				dropDashboardEntry(dashboard.id, { name, from }, target.data);
			}
		},
	});

	return (
		<div ref={container} className="h-full">
			<PaneNodeView
				dashboardId={dashboard.id}
				dashboardLayout={layout}
				focusedPaneId={focusedPaneId}
				minPaneSize={{ row: quarter(size?.width), column: quarter(size?.height) }}
				node={layout}
				root
				topLeft
			/>
		</div>
	);
}

type NodeProps = PaneNodeProps & { minPaneSize: MinPaneSize };

function PaneNodeView({ node, root = false, minPaneSize, ...props }: NodeProps & { node: PaneNode; root?: boolean }) {
	return node.kind === 'pane' ? (
		// Closing the only pane does nothing unless there's a widget to remove
		<PaneView {...props} pane={node} closable={!root || node.widget !== undefined} />
	) : (
		// Keyed so a split that takes another's place reads its own saved ratio
		<SplitView key={node.id} {...props} minPaneSize={minPaneSize} split={node} />
	);
}

function SplitView({ split, minPaneSize, ...props }: NodeProps & { split: Split }) {
	const { dashboardId } = props;
	const row = split.direction === 'row';
	const firstId = `${split.id}-first`;
	const secondId = `${split.id}-second`;
	const groupRef = useGroupRef();
	const group = useRef<HTMLDivElement>(null);
	const groupSize = useSize(group);
	// Keep every pane at least a quarter of the dashboard, so a side with a split inside needs room for its panes and the 1px dividers between them
	const paneSize = minPaneSize[split.direction];
	const minSize = (node: PaneNode) => {
		const panes = panesAlong(node, split.direction);
		return paneSize === undefined ? undefined : paneSize * panes + panes - 1;
	};
	const firstMinSize = minSize(split.first);
	const secondMinSize = minSize(split.second);
	// Both sides are as small as they can be, so the divider can't move (within a pixel of rounding)
	const locked =
		groupSize !== undefined &&
		firstMinSize !== undefined &&
		secondMinSize !== undefined &&
		(row ? groupSize.width : groupSize.height) - firstMinSize - secondMinSize - 1 < 1;

	// The group only reads `defaultLayout` when it mounts, so a ratio changed by undo or redo is applied here
	useEffect(() => {
		groupRef.current?.setLayout({ [firstId]: split.ratio * 100, [secondId]: (1 - split.ratio) * 100 });
	}, [groupRef, firstId, secondId, split.ratio]);

	return (
		<Group
			groupRef={groupRef}
			elementRef={group}
			orientation={row ? 'horizontal' : 'vertical'}
			defaultLayout={{ [firstId]: split.ratio * 100, [secondId]: (1 - split.ratio) * 100 }}
			// Called once a drag is released or a key is pressed, not on every pointer move
			onLayoutChanged={(panelLayout, { isUserInteraction, requestedLayout = panelLayout }) => {
				const size = requestedLayout[firstId];
				if (isUserInteraction && size !== undefined) {
					updateLayout(dashboardId, (layout) => resizeSplit(layout, split.id, size / 100));
				}
			}}
		>
			<Panel id={firstId} minSize={firstMinSize} style={{ overflow: 'hidden' }}>
				<PaneNodeView {...props} minPaneSize={minPaneSize} node={split.first} />
			</Panel>
			<Separator
				aria-label="Resize panes"
				// Disabled dividers don't get the hover and active highlights, and the not-allowed cursor is replaced so they don't look interactive
				disabled={locked}
				style={locked ? { cursor: 'auto' } : undefined}
				// The library's 10px hit area is mostly outside the line, so the pseudo-element catches double-clicks there
				className={cn(
					'bg-border outline-none transition-colors focus-visible:bg-ring data-[separator=active]:bg-ring data-[separator=hover]:bg-ring',
					'relative z-10 after:absolute',
					row ? 'w-px after:inset-y-0 after:-inset-x-[4.5px]' : 'h-px after:inset-x-0 after:-inset-y-[4.5px]',
				)}
				onDoubleClick={() => {
					if (locked) {
						return;
					}

					groupRef.current?.setLayout({ [firstId]: 50, [secondId]: 50 });
					updateLayout(dashboardId, (layout) => resizeSplit(layout, split.id, 0.5));
				}}
			/>
			<Panel id={secondId} minSize={secondMinSize} style={{ overflow: 'hidden' }}>
				<PaneNodeView {...props} minPaneSize={minPaneSize} topLeft={false} node={split.second} />
			</Panel>
		</Group>
	);
}
