import type { Draggable, Droppable } from '@dnd-kit/dom';
import { useDragDropMonitor } from '@dnd-kit/react';
import * as stylex from '@stylexjs/stylex';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Group, type Layout, useGroupRef } from 'react-resizable-panels';
import { PaneView, type PaneNodeProps } from '@/panes/pane-view';
import {
	DashboardLayoutContext,
	dropDashboardEntry,
	getFocusedPane,
	getZoomedPane,
	updateLayout,
} from '@/dashboards/panes';
import type { Dashboard } from '@/dashboards/dashboards';
import { type EntryDragData, type EntryDropData, type EntrySectionDropData, entryDragType } from '@/entries/drag';
import { useMinWindowSize } from '@/desktop/window-size';
import { useSize } from '@/hooks/use-size';
import { dragDivider, endDrag, snapDistance, useSplitGroup } from '@/panes/divider-snap';
import { findPane, type PaneNode, resizeSplit, type Split, type SplitDirection } from '@/panes/layout';
import { type PaneHosts, usePaneHosts } from '@/panes/pane-hosts';
import { PanePortal, PaneSlot } from '@/panes/pane-slot';
import { SplitDivider } from '@/panes/split-divider';
import { dividerSize, minNodeSize, minPaneSizeIn } from '@/panes/pane-size';
import { SplitPanel, type SplitPanelAnimation } from '@/panes/split-panel';
import { closingSplit, percentages, type SplitAnimation, splitAnimation } from '@/panes/split-animation';
import { useZoomAnimation } from '@/panes/zoom-animation';

const styles = stylex.create({
	panes: { height: '100%' },
});

export function DashboardPanes({ dashboard }: { dashboard: Dashboard }) {
	const { layout } = dashboard;
	const focusedPaneId = getFocusedPane(dashboard).id;
	const zoomedPaneId = getZoomedPane(dashboard)?.id;
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
	return (
		<div ref={container} {...stylex.props(styles.panes)} data-dashboard-panes data-zooming={zooming || undefined}>
			<DashboardLayoutContext value={layout}>
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
			</DashboardLayoutContext>
		</div>
	);
}

type NodeProps = Pick<PaneNodeProps, 'dashboardId' | 'dashboardLayout' | 'zoomedPaneId'> & {
	/** The elements panes are rendered into, see `usePaneHosts()` */
	hosts: PaneHosts;
	/** The zoomed pane once it fills the dashboard, which hides the panes in the other children of its splits */
	hiddenBy: string | undefined;
	/** Whether a zoom is animating, which lets the panes move outside their splits */
	zooming: boolean;
	/** In pixels, the smallest each pane can be along each direction, `undefined` until the dashboard's measured */
	minPaneSizes: Record<SplitDirection, number> | undefined;
};

function PaneNodeView({ node, ...props }: NodeProps & { node: PaneNode }) {
	const { zoomedPaneId } = props;
	const [previous, setPrevious] = useState({ node, zoomedPaneId });
	const [animation, setAnimation] = useState<SplitAnimation>();
	if (previous.node !== node || previous.zoomedPaneId !== zoomedPaneId) {
		setPrevious({ node, zoomedPaneId });
		const changed = previous.node === node ? undefined : splitAnimation(previous.node, node, props.dashboardLayout);
		// Closing a pane restores the zoomed pane's dashboard, which already animates the other panes back in
		if (changed && !(changed.kind === 'close' && previous.zoomedPaneId !== undefined)) {
			setAnimation(changed);
		}
	}

	if (animation?.kind === 'close') {
		return (
			<SplitView
				key={animation.split.id}
				{...props}
				split={closingSplit(animation, node)}
				animation={animation}
				onAnimationEnd={() => setAnimation(undefined)}
			/>
		);
	}

	return node.kind === 'pane' ? (
		<PaneSlot hosts={props.hosts} paneId={node.id} />
	) : (
		// Keyed so a split that takes another's place reads its own sizes
		<SplitView
			key={node.id}
			{...props}
			split={node}
			animation={animation?.split.id === node.id ? animation : undefined}
			onAnimationEnd={() => setAnimation(undefined)}
		/>
	);
}

/** In pixels, the smallest a child of a split can be for each of its panes to be at least `paneSize` along it */
function minSize(child: PaneNode, direction: SplitDirection, paneSize: number | undefined): number {
	return paneSize === undefined ? 0 : minNodeSize(child, direction, paneSize);
}

function SplitView({
	split,
	animation,
	onAnimationEnd,
	minPaneSizes,
	...props
}: NodeProps & { split: Split; animation: SplitAnimation | undefined; onAnimationEnd: () => void }) {
	const { dashboardId, hiddenBy, zooming } = props;
	const row = split.direction === 'row';
	const groupRef = useGroupRef();
	const group = useRef<HTMLDivElement>(null);
	const groupSize = useSize(group);
	const extent = row ? groupSize?.width : groupSize?.height;
	const dividers = split.children.length - 1;
	const dividersSize = dividers * dividerSize;
	// A child with a split inside needs room for its panes and the dividers between them
	const paneSize = minPaneSizes?.[split.direction];
	const minSizes = split.children.map((child) => minSize(child, split.direction, paneSize));
	// Every child is as small as it can be, so the dividers can't move (within a pixel of rounding)
	const locked = extent !== undefined && extent - minSizes.reduce((sum, size) => sum + size, 0) - dividersSize < 1;
	const minimum = (child: PaneNode) =>
		extent === undefined ? 0 : minSize(child, split.direction, paneSize) / Math.max(extent - dividersSize, 1);

	// The shares the children end at, a closing pane ends at nothing
	const targets =
		animation?.kind === 'close'
			? {
					...percentages(
						{ ...split, children: split.children.filter((child) => child.id !== animation.childId) },
						minimum,
					),
					[animation.childId]: 0,
				}
			: percentages(split, minimum);
	const from = animation && percentages(animation.split, minimum);
	// The group's layout. A closing pane keeps its share there while CSS shrinks it away, since lowering its `minSize` so it
	// could reach nothing only reaches the group after this layout is fitted to the old one. The others end in the
	// proportions they have without it, which is all that shows once it's gone.
	let groupLayout = targets;
	if (animation?.kind === 'close') {
		const kept = from?.[animation.childId] ?? 0;
		groupLayout = Object.fromEntries(
			Object.entries(targets).map(([id, share]) => [
				id,
				id === animation.childId ? kept : (share * (100 - kept)) / 100,
			]),
		);
	}
	const moving = animation ? split.children.findIndex((child) => child.id === animation.childId) : -1;

	const panelAnimation = (childId: string, index: number): SplitPanelAnimation | undefined => {
		if (!animation || !from) {
			return undefined;
		}

		const closing = animation.kind === 'close';
		const role = index === moving ? (closing ? 'leave' : 'enter') : 'stay';
		return {
			role,
			from: from[childId] ?? 0,
			closing,
			size: ((role === 'leave' ? from[childId] : targets[childId]) ?? 0) / 100,
			dividers: role === 'leave' ? animation.split.children.length - 1 : dividers - (closing ? 1 : 0),
			// The children before the moving one are pinned to their start, the ones after it to their end
			pin: index === moving ? (index === 0 ? 'end' : 'start') : index < moving ? 'start' : 'end',
		};
	};

	// The group only reads `defaultLayout` when it mounts, so new sizes are applied here, once it knows every child's panel
	const pendingLayout = useRef<Layout>(undefined);
	// oxlint-disable-next-line studio/no-manual-memo -- Effects depend on it, and `react-hooks/exhaustive-deps` can't tell that React Compiler memoizes it
	const applyLayout = useCallback(() => {
		const layout = pendingLayout.current;
		const current = groupRef.current?.getLayout();
		const ids = current && Object.keys(current);
		if (layout && ids?.length === Object.keys(layout).length && ids.every((id) => id in layout)) {
			pendingLayout.current = undefined;
			groupRef.current?.setLayout(layout);
		}
	}, [groupRef]);
	useLayoutEffect(() => {
		pendingLayout.current = groupLayout;
		applyLayout();
	}, [applyLayout, groupLayout]);

	// While a zoomed pane fills the dashboard, its splits only show the child it's in
	const zoomedHere = hiddenBy !== undefined && findPane(split, hiddenBy) !== undefined;
	// Whether the divider being dragged is lined up with another one
	const snapped = useRef(false);
	useSplitGroup(group, groupRef, split, minSizes);

	return (
		<Group
			groupRef={groupRef}
			elementRef={group}
			orientation={row ? 'horizontal' : 'vertical'}
			defaultLayout={groupLayout}
			// Called on every pointer move while a divider's dragged, before the new layout is shown
			onLayoutChange={(panelLayout) => {
				applyLayout();
				snapped.current = !animation && dragDivider(group.current, panelLayout);
			}}
			// Container units size the animating children, and panes move outside their splits while a zoom animates
			style={{ containerType: animation ? 'size' : undefined, overflow: zooming ? 'visible' : undefined }}
			// Called once a drag is released or a key is pressed, not on every pointer move
			onLayoutChanged={(panelLayout, { isUserInteraction, requestedLayout = panelLayout }) => {
				if (!isUserInteraction || animation || extent === undefined) {
					return;
				}

				const sizes = split.children.map((child) => (requestedLayout[child.id] ?? 0) / 100);
				// A divider lined up with another one stays there, unless that's also an even split
				const snap = (snapped.current ? 0.5 : snapDistance) / Math.max(extent - dividersSize, 1);
				// The dividers dragged along with it are resized in the same change, so it's one undo step
				const resizeLinks = endDrag(group.current, sizes, snap);
				updateLayout(dashboardId, (layout) => resizeLinks(resizeSplit(layout, split.id, sizes, snap)));
			}}
		>
			{split.children.flatMap((child, index) => [
				index > 0 && (
					<SplitDivider
						key={`${child.id}-separator`}
						dashboardId={dashboardId}
						splitId={split.id}
						index={index - 1}
						direction={split.direction}
						locked={locked}
						hidden={zoomedHere}
					/>
				),
				<SplitPanel
					key={child.id}
					id={child.id}
					minSize={minSizes[index]}
					direction={split.direction}
					animation={panelAnimation(child.id, index)}
					hidden={zoomedHere && findPane(child, hiddenBy) === undefined}
					zooming={zooming}
					onAnimationEnd={(event) => {
						// Ignores animations inside the pane
						if (index === moving && event.target === event.currentTarget) {
							onAnimationEnd();
						}
					}}
				>
					<PaneNodeView {...props} minPaneSizes={minPaneSizes} node={child} />
				</SplitPanel>,
			])}
		</Group>
	);
}
