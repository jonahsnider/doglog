import type { Draggable, Droppable } from '@dnd-kit/dom';
import { useDragDropMonitor } from '@dnd-kit/react';
import * as stylex from '@stylexjs/stylex';
import { useRef, useState } from 'react';
import { PaneView } from '@/panes/pane-view';
import { DashboardLayoutContext, dropDashboardEntry, getFocusedPane, getZoomedPane } from '@/dashboards/panes';
import type { Dashboard } from '@/dashboards/dashboards';
import { type EntryDragData, type EntryDropData, type EntrySectionDropData, entryDragType } from '@/entries/drag';
import { useMinWindowSize } from '@/desktop/window-size';
import { useSize } from '@/hooks/use-size';
import { useMobileLayout } from '@/lib/mobile-layout';
import { PaneNodeView } from '@/panes/docked-panes';
import { usePaneHosts } from '@/panes/pane-hosts';
import { PanePortal } from '@/panes/pane-slot';
import { minPaneSizeIn } from '@/panes/pane-size';
import { createSwipes, PaneSwipeContext } from '@/panes/pane-swipe';
import { PhonePanes } from '@/panes/phone-panes';
import { useZoomAnimation } from '@/panes/zoom-animation';

const styles = stylex.create({
	panes: { height: '100%' },
});

export function DashboardPanes({ dashboard }: { dashboard: Dashboard }) {
	const { layout } = dashboard;
	const focusedPaneId = getFocusedPane(dashboard).id;
	const mobile = useMobileLayout();
	// The phone layout shows one pane at a time, so it ignores the zoom while keeping it for the docked layout
	const zoomedPaneId = mobile ? undefined : getZoomedPane(dashboard)?.id;
	const container = useRef<HTMLDivElement>(null);
	const size = useSize(container);
	const zoom = useZoomAnimation(container, layout, zoomedPaneId);
	const zooming = zoom !== undefined;

	useMinWindowSize(layout, size);
	const minPaneSizes = size && {
		row: minPaneSizeIn(layout, 'row', size.width),
		column: minPaneSizeIn(layout, 'column', size.height),
	};

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
				dropDashboardEntry(dashboard.id, source.data, target.data);
			}
		},
	});

	const { hosts, shown } = usePaneHosts(layout);
	// Pane headers pass swipes to `PhonePanes` through context, since the panes stay in one place in the tree to keep their state
	const [swipes] = useState(createSwipes);
	return (
		<div ref={container} {...stylex.props(styles.panes)} data-dashboard-panes data-zooming={zooming || undefined}>
			<DashboardLayoutContext value={layout}>
				{mobile ? (
					<PhonePanes
						dashboardId={dashboard.id}
						layout={layout}
						focusedPaneId={focusedPaneId}
						hosts={hosts}
						swipes={swipes}
					/>
				) : (
					<PaneNodeView
						dashboardId={dashboard.id}
						dashboardLayout={layout}
						zoomedPaneId={zoomedPaneId}
						hiddenBy={zooming ? undefined : zoomedPaneId}
						zooming={zooming}
						minPaneSizes={minPaneSizes}
						hosts={hosts}
						node={layout}
					/>
				)}
				<PaneSwipeContext value={mobile ? swipes.emit : undefined}>
					{shown.map((pane) => (
						<PanePortal key={pane.id} hosts={hosts} paneId={pane.id}>
							<PaneView
								dashboardId={dashboard.id}
								dashboardLayout={layout}
								focusedPaneId={focusedPaneId}
								zoomedPaneId={zoomedPaneId}
								zoomFillingPaneId={zoom?.zoomingIn === true ? zoom.paneId : undefined}
								pane={pane}
								// Closing the only pane does nothing unless there's a widget to remove
								closable={layout.kind === 'split' || pane.widget !== undefined}
							/>
						</PanePortal>
					))}
				</PaneSwipeContext>
			</DashboardLayoutContext>
		</div>
	);
}
