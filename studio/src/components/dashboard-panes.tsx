import type { Draggable, Droppable } from '@dnd-kit/dom';
import { useDragDropMonitor } from '@dnd-kit/react';
import { useEffect } from 'react';
import { Group, Panel, Separator, useGroupRef } from 'react-resizable-panels';
import { PaneView, type PaneNodeProps } from '@/components/pane-view';
import { dropDashboardEntry, getFocusedPane, updateLayout } from '@/dashboard-panes';
import type { Dashboard } from '@/dashboards';
import { type EntryDragData, type EntryDropData, type EntrySectionDropData, entryDragType } from '@/entry-drag';
import { cn } from '@/lib/utils';
import { type PaneNode, resizeSplit, type Split } from '@/pane-layout';

export function DashboardPanes({ dashboard }: { dashboard: Dashboard }) {
	const { layout } = dashboard;
	const focusedPaneId = getFocusedPane(dashboard).id;

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
				dropDashboardEntry(dashboard.id, source.data.name, source.data.paneId, target.data);
			}
		},
	});

	return (
		<PaneNodeView
			dashboardId={dashboard.id}
			dashboardLayout={layout}
			focusedPaneId={focusedPaneId}
			node={layout}
			root
			topLeft
		/>
	);
}

function PaneNodeView({ node, root = false, ...props }: PaneNodeProps & { node: PaneNode; root?: boolean }) {
	return node.kind === 'pane' ? (
		// Closing the only pane does nothing unless there's a widget to remove
		<PaneView {...props} pane={node} closable={!root || node.widget !== undefined} />
	) : (
		// Keyed so a split that takes another's place reads its own saved ratio
		<SplitView key={node.id} {...props} split={node} />
	);
}

function SplitView({ split, ...props }: PaneNodeProps & { split: Split }) {
	const { dashboardId } = props;
	const row = split.direction === 'row';
	const firstId = `${split.id}-first`;
	const secondId = `${split.id}-second`;
	const groupRef = useGroupRef();

	// The group only reads `defaultLayout` when it mounts, so a ratio changed by undo or redo is applied here
	useEffect(() => {
		groupRef.current?.setLayout({ [firstId]: split.ratio * 100, [secondId]: (1 - split.ratio) * 100 });
	}, [groupRef, firstId, secondId, split.ratio]);

	return (
		<Group
			groupRef={groupRef}
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
			{/* Keep panes big enough for their controls */}
			<Panel id={firstId} minSize="7rem" style={{ overflow: 'hidden' }}>
				<PaneNodeView {...props} node={split.first} />
			</Panel>
			<Separator
				aria-label="Resize panes"
				// The library's 10px hit area is mostly outside the line, so the pseudo-element catches double-clicks there
				className={cn(
					'bg-border outline-none transition-colors focus-visible:bg-ring data-[separator=active]:bg-ring data-[separator=hover]:bg-ring',
					'relative z-10 after:absolute',
					row ? 'w-px after:inset-y-0 after:-inset-x-[4.5px]' : 'h-px after:inset-x-0 after:-inset-y-[4.5px]',
				)}
				onDoubleClick={() => {
					groupRef.current?.setLayout({ [firstId]: 50, [secondId]: 50 });
					updateLayout(dashboardId, (layout) => resizeSplit(layout, split.id, 0.5));
				}}
			/>
			<Panel id={secondId} minSize="7rem" style={{ overflow: 'hidden' }}>
				<PaneNodeView {...props} topLeft={false} node={split.second} />
			</Panel>
		</Group>
	);
}
